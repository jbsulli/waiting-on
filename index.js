"use strict";

module.exports = WaitingOn;

function WaitingOn(count_or_event){
    this.count = 0;
    this.ready = false;
    
    if(arguments.length === 0){
        return;
    }
    
    var args = Array.prototype.slice.call(arguments, 0);
    
    if(typeof count_or_event === 'number'){
        this.add(args.shift());
    }
    
    if(args.length > 0){
        this.events.apply(this, args);
    }
}

WaitingOn.prototype.add = function(count){
    if(!('count' in this)){
        throw new Error('Finally already called.');
    }
    // must be a positive number, not infinity, and an integer
    if(count < 0 || count !== +count || count !== (count|0)){
        throw new Error('Invalid count value');
    }
    this.count += count;
    return this;
};

WaitingOn.prototype.after = function(event_name, callback, thisArg){
    if(!this.after_events){
        this.after_events = {};
    }
    
    var events = Array.prototype.slice.call(arguments, 0);
    callback = events.pop();
    
    // thisArg passed?
    if(typeof callback !== 'function'){
        thisArg = callback;
        callback = events.pop();
    
        if(typeof callback !== 'function'){
            throw new Error('Callback function is required');
        }
    } else {
        if(events.length < 1){
            throw new Error('Missing event to wait for');
        }
        
        if(typeof events[events.length - 1] === 'function'){
            thisArg = callback;
            callback = events.pop();
        }
    }
    
    if(events.length < 1){
        throw new Error('Missing event to wait for');
    }
    
    var after = { events:events, callback:callback, thisArg:thisArg };
    
    for(var i = 0; i < events.length; i++){
        if(this.after_events[events[i]]){
            this.after_events[events[i]].push(after);
        } else {
            this.after_events[events[i]] = [after];
        }
    }
    
    return this;
};

WaitingOn.prototype._afterEvents = function(){
    var events = this._after_events;
    var event, after, afters, i, j, k, l, p;
    delete this._after_events;
    
    for(i = 0; i < events.length; i++){
        event = events[i];
        
        if(event in this.after_events){
            afters = this.after_events[event];
            
            for(j = 0; j < afters.length; j++){
                after = afters[j];
            
                if(!this.any.apply(this, after.events)){
                    try {
                        after.callback.call(after.thisArg);
                    } catch(err){
                        this.error(err);
                    }
                    
                    afters.splice(j, 1);
                    
                    for(k = 0; k < after.events.length; k++){
                        p = after.events[k];
                        if(p in this.after_events && ~(l = this.after_events[p].indexOf(after))){
                            this.after_events[p].splice(l, 1);
                            if(this.after_events[p].length === 0){
                                delete this.after_events[p];
                            }
                        }
                    }
                    
                    j--;
                }
            }
            
            if(afters.length === 0){
                delete this.after_events[event];
            }
        }
    }
};

WaitingOn.prototype.any = function(){
    if(!this.waiting_on){
        return false;
    }
    
    var keys = Array.prototype.slice.call(arguments, 0);
    while(keys.length){
        if(this.waiting_on[keys.pop()]){
            return true;
        }
    }
    
    return false;
};

WaitingOn.prototype.callback = function(callback, thisArg){
    var waiting_on = this;
    this.add(1);
    
    return function(){
        var result;
        
        try {
            result = callback.apply(thisArg, Array.prototype.slice.call(arguments, 0));
        } catch(err){
            waiting_on.error(err);
        }
        
        waiting_on.finished();
        
        return result;
    };
};

WaitingOn.prototype.error = function(err){
    if(arguments.length > 0){
        if(!('errors' in this)){
            this.errors = [];
        }
        this.errors.push(err);
    }
    return this;
};

WaitingOn.prototype.finished = function(event_name){
    var waiting_on = this;
    
    if(arguments.length === 0){
        this.count--;
    } else {
        var events = Array.prototype.slice.call(arguments, 0);
        var event, after_events;
        
        while(events.length){
            event = events.shift();
            
            if(this.waiting_on && event in this.waiting_on){
                if(this.waiting_on[event] > 1){
                    this.waiting_on[event] = this.waiting_on[event] - 1; 
                } else {
                    // last one
                    delete this.waiting_on[event];
                    
                    if(this.after_events && event in this.after_events){
                        if(!after_events){
                            after_events = this._after_events || [];
                        }
                        after_events.push(event);
                    }
                }
            } else {
                throw new Error('Unknown event finished. [' + event + ']');
            }
            
            this.count--;
        }
        
        if(after_events && !('_after_events' in this)){
            this._after_events = after_events;
            
            setTimeout(function(){
                waiting_on._afterEvents();
            }, 0);
        }
    }
    
    if(this.count === 0){
        if(this._finally){
            setTimeout(function(){
                if(waiting_on.count === 0){
                    delete waiting_on.count;
                    waiting_on._finally.call(waiting_on._finally_this, waiting_on.errors);
                }
            }, 0);
        }
    }
    return this;
};

WaitingOn.prototype.holdup = function(){
    if(this.waiting_on){
        var keys = Object.keys(this.waiting_on);
        if(keys.length > 0){
            return keys;
        }
    }
    return this.count;
};

WaitingOn.prototype.event = function(event, callback, thisArg){
    this.events(event);
    var waiting_on = this;
    
    return function(){
        var result;
        
        try {
            result = callback.apply(thisArg, Array.prototype.slice.call(arguments, 0));
        } catch(err){
            waiting_on.error(err);
        }
        
        waiting_on.finished(event);
        
        return result;
    };
};

WaitingOn.prototype.events = function(event){
    if(!('count' in this)){
        throw new Error('Finally already called.');
    }
    
    var args = Array.prototype.slice.call(arguments, 0);
    var arg;
    
    if(args.length > 0){
        if(!this.waiting_on){
            this.waiting_on = {};
        }
        
        while(args.length){
            arg = args.shift();
            if(!arg || typeof arg !== 'string'){
                throw new Error('Event name must be a string with one or more characters');
            }
            this.waiting_on[arg] = (this.waiting_on[arg] ? this.waiting_on[arg] + 1 : 1);
            this.count++;
        }
    }
    return this;
};

WaitingOn.prototype.finally = function(callback, thisArg){
    if('_finally' in this){
        throw new Error('Finally already set!');
    }
    
    this._finally = callback;
        
    if(thisArg !== undefined){
        this._finally_this = thisArg;
    }
    
    delete this.ready;
    this.count++;
    this.finished();
    
    return this;
};

WaitingOn.waitingOn = function(){
    var wait = new WaitingOn();
    
    if(arguments.length > 0){
        var args = Array.prototype.slice.call(arguments, 0);
        
        if(typeof args[0] === 'number'){
            wait.add(args.shift());
        }
        
        if(args.length > 0){
            wait.events.apply(wait, args);
        }
    }
    
    return wait;
};