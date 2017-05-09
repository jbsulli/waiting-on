# WaitingOn

WaitingOn is a module for tracking multiple, asynchronous events. Also can tell you what you're still "waiting on." 

## Installation

```javascript
npm install --save waiting-on
```

## Using

Simple example:

```javascript
const waitingOn = require('waiting-on').waitingOn;

// ...

var wait = waitingOn();
var products;

// some asynchronous event
API.get('products', wait.callback((err, prods) => {
    if(err) {
        return wait.error(err);
    }
    // do stuff like save to local var
    products = prods;
}));

wait.finally(errors => {
    if(errors){
        return errors.forEach(err => console.log(err));
    }
    console.log('done!', products);
})
```

Maybe you need to wait for a lot of things:

```javascript
app.post('/files', (req, res) => {
    var wait = waitingOn();
    
    req.files.forEach(file => {
        // upload to S3, DropBox, some server...
        Upload(file.name, file.buff, 
            // wrap a callback. pass an event name as first argument
            wait.event(file.name, err => {
                // save errors for finally call
                if(err) return wait.error(err);
            })
        );
    });
    
    // print array of filenames we're waiting on
    console.log(wait.holdup());
    
    // will be called after all files have been uploaded
    wait.finally(errors => {
        // undefined or array of errors
        if(errors){
            return res.error(new Error("could not upload files"));
        }
        // success!
        res.send({ success:true });
    });
});
```

Or maybe life gets really complicated:

```javascript
var data = {};

wait('get user');

// user logged in?
getUserFromSession(req, (err, user) => {
    if(err) {
        // user not logged in...
        if(err.code === 'ENOTLOGGEDIN'){
            // try to log them in and get the user info
            return getUserFromLoginAttempt(req, wait.event('user login', (err, user) => {
                // bad stuff...
                if(err) return wait.error(err);
                
                // success
                wait.finished('get user');
                data.user = user;
            }));
        }
        
        // some error with the session
        return wait.error(err);
    }
    
    // success
    wait.finished('get user');
    data.user = user;
});

// when we have the user...
wait.after('get user', (errors) => {
    if(errors || !data.user){
        return;
    }
    
    // load pictures and likes
    loadUserPics(data.user, wait.event('pictures', (err, pics) => {
        if(err) return wait.error(err);
        data.user.pics = pics;
        
        // get comments for each picture
        pics.forEach(pic => {
            if(pic.comment_count > 0){
                // there are comments on this pic so load them
                // Note: every event string holds its own internal counter which is why this is possible
                loadUserPicComments(user, pic, wait.event('picture comments', (err, comments) => {
                    if(err) return wait.error(err);
                    pic.comments = comments;
                }));
            }
        });
    }));
    
    // load likes
    loadUserLikes(user, (err, likes) => {
        if(err) return wait.error(err);
        data.user.likes = likes;
    });
});

wait.finally(errors => {
    if(errors){
        return res.send({ errors:errors });
    }
    
    res.send(data);
});
```

For the previous example, you could set up the following timer:

```javascript
var logger = setInterval(() => {
    console.log(wait.holdup());
    if(!wait.any()){
        clearInterval(logger);
    }
});
```

... to output something like:
```
['get user'] // waiting for user info
['get user']
['get user', 'user login'] // user not on session, attempting login
['get user', 'user login']
['get user', 'user login']
['pictures', 'likes'] // got the user from the login, now loading pictures and likes
['pictures', 'likes']
['pictures'] // likes finished loading
['picture comments'] // we are still waiting on at least one picture's comments
['picture comments']
['picture comments']
['picture comments']
['picture comments']
['picture comments']
['picture comments']
['picture comments']
[] // everything has finished loading
```

## Reference

### `.add([count], [event...])`

- `count`: `Number` - Add to our general counter this many things to wait for.
- `event`: `String` - Any number of event names to wait for. The same string can be used multiple times. Note that once you use an event name, you must specify the event name when calling `.finished()`.
- *returns*: `wait` - Function is chainable.

The `.add()` function is for adding to the internal counters. Internally, `.callback()` and `.event()` call `.add()` to bump up the counts. `.finished()` can later be used to reduce the internal counters. Once we are not waiting on anything, `.finally()` will be called and the wait will be done.

**Note**: if called without arguments, it behaves like `.add(1)` in that it adds one to the general count.

### `.any()`

- *returns*: `Boolean`

This is a fast way to tell if we are currently waiting on anything. It will return as soon as it finds a counter greater than `1`.

### `.after(event..., callback)`

- `event`: `String` - One or more events that you want to wait for.
- `callback`: `function([errors])` - Callback to be called once all the events have finished loading. Any errors that have occurred so far will be passed to the callback.

Once these events have finished, the callback will be called. The callback is guaranteed to be called BEFORE the `.finally()` callback (in case you want to add more events to wait on). This function is handy if you're waiting on only a subset of events before you can load another resource -- you then don't have to wait for all the resources finish before loading the additional resources.

### `.callback(callback, [thisArg])`

- `callback`: `function` - Callback you would like to wait for.
- `thisArg`: `*` - optional `thisArg` to use when calling your callback. Eliminates the need to bind your callback function.
- *returns*: `function`

This handy function can be used to wrap any callback. When it is called, it internally call `.add(1)`. When the returned function is called, it will call your callback with the `thisArg` from within a `try...catch`. Any errors caught will be passed to `.error()` to be handle by `.finally()`. 

**Hint**: You can continue to add events to wait on within from within your callback. Only after the callback returns do we check to see if all counters are zero.

### `.error(error)`

- `error`: `*` - An error value to pass back to `.finally()`.

Use this function to add a value to the internal errors array. This array will be passed to the `.finally()` callback.

### `.event(event, callback, [thisArg])`

- `event`: `String` - The event this callback is waiting for.
- `callback`: `function` - Callback you would like to wait for.
- `thisArg`: `*` - optional `thisArg` to use when calling your callback. Eliminates the need to bind your callback function.
- *returns*: `function`

Similar to the `.callback()` function but takes a named event to pass to `.add()`.

### `.finally(callback, [thisArg])`

- `callback`: `function([errors])` - Callback you would like to call when you are done waiting on things.
- `thisArg`: `*` - optional `thisArg` to use when calling your callback. Eliminates the need to bind your callback function.

This is how you indicate you are done setting up events and that the wait is on. Once all counters reach zero (and any wrapped callbacks have returned), the callback function will be called using the `thisArg` value. If there were any errors, the callback's first argument will be an array of errors (even if there was only a single error). 

### `.finished([count], [event...])`

- `count`: `Number` - Remove from our general counter this many things to wait for.
- `event`: `String` - Any number of events that completed. The same string can be used multiple times.
- *returns*: `wait` - Function is chainable.

This function is the opposite of `.add()`. It will decrement the general counter and/or individual event counters.

### `.holdup()`

- *returns*: `Number|[String]` - If there are any events we are waiting on, it will return an array of event strings, otherwise, it will return the general counter count.

This is a good way to track which events still haven't finished and/or haven't called `.finished()`.