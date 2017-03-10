"use strict";

/* globals describe, it */

var chai = require('chai');
var expect = chai.expect;
chai.use(require('dirty-chai'));

var WaitingOn = require('../index.js');
var waitingOn = WaitingOn.waitingOn;

describe('WaitingOn', function(){
    describe('new', function(){
        it('should initialize an instance of WaitingOn', function(){
            var wait = new WaitingOn();
            expect(wait).to.be.instanceof(WaitingOn);
        });
        
        it('should add to the count if a number was passed as the first argument', function(){
            var wait = new WaitingOn(10);
            expect(wait).to.be.instanceof(WaitingOn);
            expect(wait.holdup()).to.equal(10);
        });
        
        it('should add all string arguments as event names needing to be finished', function(){
            var wait = new WaitingOn('a','b','c');
            expect(wait).to.be.instanceof(WaitingOn);
            expect(wait.holdup().sort()).to.deep.equal(['a','b','c']);
        });
        
        it('should be able to take a number followed by event names', function(){
            var wait = new WaitingOn(2, 'a','b','c');
            expect(wait).to.be.instanceof(WaitingOn);
            expect(wait.holdup().sort()).to.deep.equal(['a','b','c']);
            wait.finished('a', 'b', 'c');
            expect(wait.holdup()).to.equal(2);
        });
    });
    
    describe('.add()', function(){
        it('should add the amount passed to the internal wait count', function(){
            var wait = waitingOn();
            expect(wait.holdup()).to.equal(0);
            wait.add(1);
            expect(wait.holdup()).to.equal(1);
            wait.add(10);
            expect(wait.holdup()).to.equal(11);
        });
    
        it('should not allow a bad count value', function(){
            var error_message = /^Invalid count value$/;
            expect(() => waitingOn().add(-1)).to.throw(Error, error_message);
            expect(() => waitingOn().add(Number.POSITIVE_INFINITY)).to.throw(Error, error_message);
            expect(() => waitingOn().add(Number.NaN)).to.throw(Error, error_message);
            expect(() => waitingOn().add(1.5)).to.throw(Error, error_message);
            expect(() => waitingOn().add(undefined)).to.throw(Error, error_message);
        });
        
        it('should not allow adding a count if finally has already been called', function(done){
            var wait = waitingOn();
            
            wait.finally(function(errors){
                expect(errors).to.equal(undefined);
                expect(() => wait.add(1)).to.throw(Error, /^Finally already called\.$/);
                done();
            });
        });
        
        it('should be chainable', function(){
            var wait = waitingOn();
            expect(wait.add(1)).to.equal(wait);
        });
    });
    
    describe('.after()', function(){
        it('should setup events to watch for and call the callback whent those events are done', function(done){
            var wait = waitingOn('a', 'b', 'c');
            var step = 0;
            
            wait.after('a', () => {
                expect(++step).to.equal(2);
            });
            wait.after('b', () => {
                expect(++step).to.equal(3);
            });
            wait.after('c', () => {
                expect(++step).to.equal(1);
            });
            wait.finished('c','a','b').finally(errors => {
                expect(errors).to.equal(undefined);
                expect(step).to.equal(3);
                done();
            });
        });
        
        it('should be able to listen for multiple events to finish', function(done){
            var wait = waitingOn('a', 'b', 'c');
            var step = 0;
            
            wait.after('b', () => {
                expect(++step).to.equal(1);
            });
            wait.after('c', 'a', () => {
                expect(++step).to.equal(3);
            });
            wait.finished('a','b').finally(errors => {
                expect(errors).to.equal(undefined);
                expect(step).to.equal(3);
                done();
            });
            setTimeout(() => {
                wait.finished('c');
                expect(++step).to.equal(2);
            }, 50);
        });
        
        it('should gracefully handle duplicate events in the list of events to wait for', function(done){
            var wait = waitingOn('a', 'b');
            var step = 0;
            
            // two 'b' events
            wait.after('a', 'b', 'b', () => {
                step++;
            });
            
            wait.finished('a','b').finally(errors => {
                expect(errors).to.equal(undefined);
                expect(step).to.equal(1);
                done();
            });
        });
        
        it('should be able to listen for multiple events finishing at the same time', function(done){
            var wait = waitingOn('a', 'b', 'c');
            var step = 0;
            
            wait.after('b', () => {
                step++;
            });
            wait.after('c', 'a', () => {
                step++;
            });
            wait.finished('a','b','c').finally(errors => {
                expect(errors).to.equal(undefined);
                expect(step).to.equal(2);
                done();
            });
        });
        
        it('should be able to handle multiple listeners for multiple events', function(done){
            var wait = waitingOn('a', 'b', 'c');
            var step = 0;
            
            wait.after('c', 'a', () => {
                step++;
            });
            
            wait.after('c', () => {
                step++;
            });
            
            wait.finished('a','b','c').finally(errors => {
                expect(errors).to.equal(undefined);
                expect(step).to.equal(2);
                done();
            });
        });
        
        it('should use a thisArg if passed', function(done){
            var step = 0;
            var wait = waitingOn('a');
            
            wait.after('a', function(){
                step++;
                expect(this).to.equal(wait);
            }, wait);
            
            wait.finished('a').finally(errors => {
                expect(errors).to.equal(undefined);
                expect(step).to.equal(1);
                done();
            });
        });
        
        it('should allow a function for the thisArg', function(done){
            var step = 0;
            var wait = waitingOn('a');
            var a_function = function(){};
            
            wait.after('a', function(){
                step++;
                expect(this).to.equal(a_function);
            }, a_function);
            
            wait.finished('a').finally(errors => {
                expect(errors).to.equal(undefined);
                expect(step).to.equal(1);
                done();
            });
        });
        
        it('should require an event name and callback function', function(){
            expect(() => waitingOn().after()).to.throw(Error, /^Callback function is required$/);
            expect(() => waitingOn('a').after()).to.throw(Error, /^Callback function is required$/);
            expect(() => waitingOn().after(function(){})).to.throw(Error, /^Missing event to wait for$/);
            expect(() => waitingOn().after(function(){}, function(){})).to.throw(Error, /^Missing event to wait for$/);
        });
        
        it('should catch thrown errors in the callback', function(done){
            var err;
            waitingOn('test')
                .after('test', () => {
                    throw err;
                })
                .finally(errors => {
                    expect(errors).to.deep.equal([err]);
                    done();
                })
                .finished('test');
        });
        
        it('should be chainable', function(){
            var wait = waitingOn();
            expect(wait.after('test', () => {})).to.equal(wait);
        });
    });
    
    describe('.any()', function(){
        it('should tell you if we are waiting on any of the passed events', function(done){
            var wait = waitingOn();
            expect(wait.any('a')).to.equal(false);
            wait.events('a','b','c');
            wait.finally(errors => {
                expect(errors).to.equal(undefined);
                expect(wait.any('a','b','c')).to.equal(false);
                done();
            });
            expect(wait.any('a')).to.equal(true);
            expect(wait.any('z')).to.equal(false);
            expect(wait.any('z', 'a')).to.equal(true);
            expect(wait.any('z', 'y')).to.equal(false);
            wait.finished('a');
            expect(wait.any('a')).to.equal(false);
            wait.finished('b', 'c');
            expect(wait.any('a','b','c')).to.equal(false);
        });
    });
    
    describe('.callback()', function(){
        it('should return a function that will call our callback and then call finished', function(done){
            var wait = waitingOn();
            var callback_called = false;
            
            setTimeout(wait.callback(() => {
                callback_called = true;
                // should still be holding things up until after the callback returns
                expect(wait.holdup()).to.deep.equal(1);
            }), 50);
            
            expect(wait.holdup()).to.deep.equal(1);
            
            wait.finally(errors => {
                expect(errors).to.equal(undefined);
                expect(callback_called).to.equal(true);
                done();
            });
        });
        
        it('should use the thisArg if set', function(done){
            var wait = waitingOn();
            var callback_called = false;
            
            setTimeout(wait.callback(function(){
                callback_called = true;
                expect(wait).to.equal(wait);
            }, wait), 50);
            
            wait.finally(() => {
                expect(callback_called).to.equal(true);
                done();
            });
        });
        
        it('should log an error if there was an error thown while in the callback', function(done){
            var wait = waitingOn();
            var err = new Error('bad stuff');
            
            setTimeout(wait.callback(function(){
                throw err;
            }, wait), 50);
            
            wait.finally(errors => {
                expect(errors).to.deep.equal([err]);
                done();
            });
        });
    });
    
    describe('.error()', function(){
        it('should log an error to be sent to finally', function(done){
            var wait = waitingOn();
            var err = new Error('test');
            wait.error(err);
            wait.finally(errors => {
                expect(errors).to.deep.equal([err]);
                done();
            });
        });
        
        it('should be able to be called multiple times', function(done){
            var wait = waitingOn();
            var err1 = new Error('1');
            var err2 = new Error('2');
            wait.error(err1).error(err2).finally(errors => {
                expect(errors).to.deep.equal([err1, err2]);
                done();
            });
        });
        
        it('should just do nothing if called without an argument', function(done){
            waitingOn().error().finally(errors => {
                expect(errors).to.equal(undefined);
                done();
            });
        });
        
        it('should be chainable', function(){
            var wait = waitingOn();
            expect(wait.error(new Error("test"))).to.equal(wait);
        });
    });
    
    describe('.finished()', function(){
        it('should throw an error given an unknown event', function(){
            expect(() => waitingOn().finished('a')).to.throw(Error, /^Unknown event finished\. \[a\]$/);
            expect(() => waitingOn('b').finished('a')).to.throw(Error, /^Unknown event finished\. \[a\]$/);
        });
        
        it('should be chainable', function(){
            var wait = waitingOn(1);
            expect(wait.finished()).to.equal(wait);
        });
    });
    
    describe('.holdup()', function(){
        it('should return what we are still waiting on', function(){
            var wait = new WaitingOn(1, 'a', 'b', 'c');
            expect(wait.holdup()).to.deep.equal(['a','b','c']);
            wait.finished('a','b','c');
            expect(wait.holdup()).to.equal(1);
            wait.finished();
            expect(wait.holdup()).to.equal(0);
        });
    });
    
    describe('.event()', function(){
        it('should register an event we are waiting on and return a function that will call our callback and then call finished with our event name', function(done){
            var wait = waitingOn();
            var callback_called = false;
            
            setTimeout(wait.event('timer', () => {
                callback_called = true;
                // should still be holding things up until after the callback returns
                expect(wait.holdup()).to.deep.equal(['timer']);
            }), 50);
            
            expect(wait.holdup()).to.deep.equal(['timer']);
            
            wait.finally(errors => {
                expect(errors).to.equal(undefined);
                expect(callback_called).to.equal(true);
                done();
            });
        });
        
        it('should use the thisArg if set', function(done){
            var wait = waitingOn();
            var callback_called = false;
            
            setTimeout(wait.event('timer', function(){
                callback_called = true;
                expect(wait).to.equal(wait);
            }, wait), 50);
            
            wait.finally(errors => {
                expect(errors).to.equal(undefined);
                expect(callback_called).to.equal(true);
                done();
            });
        });
        
        it('should log an error if there was an error thown while in the callback', function(done){
            var wait = waitingOn();
            var err = new Error('bad stuff');
            
            setTimeout(wait.event('timer', function(){
                throw err;
            }, wait), 50);
            
            wait.finally(errors => {
                expect(errors).to.be.an('array');
                expect(errors).to.deep.equal([err]);
                done();
            });
        });
    });
    
    describe('.events()', function(){
        it('should add proccesses to the wait list', function(done){
            var all_done = false;
            var wait = waitingOn().events('a', 'b').finally(errors => {
                expect(errors).to.equal(undefined);
                expect(all_done).to.equal(true);
                done();
            });
            
            wait.finished('a');
            wait.finished('b');
            all_done = true;
        });
        
        it('should be ok with no arguments', function(){
            waitingOn().events();
        });
        
        it('should be not be ok with non-string or empty string arguments', function(){
            var error_message = /^Event name must be a string with one or more characters$/;
            expect(() => waitingOn().events(undefined)).to.throw(Error, error_message);
            expect(() => waitingOn().events('')).to.throw(Error, error_message);
            expect(() => waitingOn().events(false)).to.throw(Error, error_message);
            expect(() => waitingOn().events(true)).to.throw(Error, error_message);
            expect(() => waitingOn().events([])).to.throw(Error, error_message);
            expect(() => waitingOn().events({})).to.throw(Error, error_message);
            expect(() => waitingOn().events(function(){})).to.throw(Error, error_message);
            expect(() => waitingOn().events(() => {})).to.throw(Error, error_message);
            expect(() => waitingOn().events(1)).to.throw(Error, error_message);
            expect(() => waitingOn().events(0)).to.throw(Error, error_message);
            expect(() => waitingOn().events(null)).to.throw(Error, error_message);
        });
        
        it('should not allow adding proccesses if finally has already been called', function(done){
            var wait = new WaitingOn();
            wait.finally(errors => {
                expect(errors).to.equal(undefined);
                expect(() => wait.events('bad')).to.throw(Error, /^Finally already called\.$/);
                done();
            });
        });
        
        it('should be able to be called multiple times', function(){
            var wait = waitingOn().events('a', 'b', 'c');
            wait.events('d','e','f');
            expect(wait.holdup().sort()).to.deep.equal(['a','b','c','d','e','f']);
        });
        
        it('should allow multiple of the same event', function(){
            var wait = waitingOn().events('a', 'a', 'a');
            expect(wait.holdup()).to.deep.equal(['a']);
            wait.finished('a');
            expect(wait.holdup()).to.deep.equal(['a']);
            wait.finished('a', 'a');
            expect(wait.holdup()).to.equal(0);
        });
        
        it('should be chainable', function(){
            var wait = waitingOn();
            expect(wait.events('test')).to.equal(wait);
        });
    });
    
    describe('finally', function(){
        it('should call its callback when we are no longer waiting on anything', function(done){
            waitingOn().finally(errors => {
                expect(errors).to.equal(undefined);
                done();
            });
        });
        
        it('should not allow calling finally twice', function(){
            expect(() => waitingOn().finally().finally(() => {})).to.throw(Error, /Finally already set!/);
        });
        
        it('should use the thisArg when passed', function(done){
            var wait = new WaitingOn();
            wait.finally(function(errors){
                expect(errors).to.equal(undefined);
                expect(this).to.equal(wait);
                done();
            }, wait);
        });
        
        it('should allow a new event/count after the finally is already scheduled for the next tick', function(done){
            var wait = waitingOn(1);
            var second_task = false;
            
            wait.finally(errors => {
                expect(errors).to.equal(undefined);
                expect(second_task).to.equal(true);
                done();
            });
            
            wait.finished();
            
            setTimeout(wait.callback(() => {
                second_task = true;
            }), 100);
        });
        
        it('should be chainable', function(){
            var wait = waitingOn();
            expect(wait.finally(() => {})).to.equal(wait);
        });
    });
});