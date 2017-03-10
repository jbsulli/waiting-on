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
        
        it('should add all string arguments as process names needing to be finished', function(){
            var wait = new WaitingOn('a','b','c');
            expect(wait).to.be.instanceof(WaitingOn);
            expect(wait.holdup().sort()).to.deep.equal(['a','b','c']);
        });
        
        it('should be able to take a number followed by process names', function(){
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
            
            wait.finally(function(){
                expect(() => wait.add(1)).to.throw(Error, /^Finally already called\.$/);
                done();
            });
        });
    });
    
    describe('.after()', function(){
        it('should setup processes to watch for and call the callback whent those processes are done', function(done){
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
            wait.finished('c','a','b').finally(() => {
                expect(step).to.equal(3);
                done();
            });
        });
        
        it('should be able to listen for multiple processes to finish', function(done){
            var wait = waitingOn('a', 'b', 'c');
            var step = 0;
            
            wait.after('b', () => {
                expect(++step).to.equal(1);
            });
            wait.after('c', 'a', () => {
                expect(++step).to.equal(3);
            });
            wait.finished('a','b').finally(() => {
                expect(step).to.equal(3);
                done();
            });
            setTimeout(() => {
                wait.finished('c');
                expect(++step).to.equal(2);
            }, 50);
        });
        
        it('should gracefully handle duplicate processes in the list of processes to wait for', function(done){
            var wait = waitingOn('a', 'b');
            var step = 0;
            
            // two 'b' processes
            wait.after('a', 'b', 'b', () => {
                expect(++step).to.equal(1);
            });
            
            wait.finished('a','b').finally(() => {
                expect(step).to.equal(1);
                done();
            });
        });
        
        it('should be able to listen for multiple processes finishing at the same time', function(done){
            var wait = waitingOn('a', 'b', 'c');
            var step = 0;
            
            wait.after('b', () => {
                expect(++step).to.equal(1);
            });
            wait.after('c', 'a', () => {
                expect(++step).to.equal(2);
            });
            wait.finished('a','b','c').finally(() => {
                expect(step).to.equal(2);
                done();
            });
        });
        
        it('should be able to handle multiple listeners for multiple processes', function(done){
            var wait = waitingOn('a', 'b', 'c');
            var step = 0;
            
            wait.after('c', 'a', () => {
                expect(++step).to.equal(1);
            });
            
            wait.after('c', () => {
                expect(++step).to.equal(2);
            });
            
            wait.finished('a','b','c').finally(() => {
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
            
            wait.finished('a').finally(() => {
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
            
            wait.finished('a').finally(() => {
                expect(step).to.equal(1);
                done();
            });
        });
        
        it('should require a process name and callback function', function(){
            expect(() => waitingOn().after()).to.throw(Error, /^Callback function is required$/);
            expect(() => waitingOn('a').after()).to.throw(Error, /^Callback function is required$/);
            expect(() => waitingOn().after(function(){})).to.throw(Error, /^Missing process to wait for$/);
            expect(() => waitingOn().after(function(){}, function(){})).to.throw(Error, /^Missing process to wait for$/);
        });
    });
    
    describe('.any()', function(){
        it('should tell you if we are waiting on any of the passed processes', function(done){
            var wait = waitingOn();
            expect(wait.any('a')).to.equal(false);
            wait.processes('a','b','c');
            wait.finally(() => {
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
            
            wait.finally(() => {
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
            
            wait.finally((errors) => {
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
    });
    
    describe('.finished()', function(){
        it('should throw an error given an unknown process', function(){
            expect(() => waitingOn().finished('a')).to.throw(Error, /^Unknown process finished\. \[a\]$/);
            expect(() => waitingOn('b').finished('a')).to.throw(Error, /^Unknown process finished\. \[a\]$/);
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
    
    describe('.process()', function(){
        it('should register a process we are waiting on and return a function that will call our callback and then call finished with our process name', function(done){
            var wait = waitingOn();
            var callback_called = false;
            
            setTimeout(wait.process('timer', () => {
                callback_called = true;
                // should still be holding things up until after the callback returns
                expect(wait.holdup()).to.deep.equal(['timer']);
            }), 50);
            
            expect(wait.holdup()).to.deep.equal(['timer']);
            
            wait.finally(() => {
                expect(callback_called).to.equal(true);
                done();
            });
        });
        
        it('should use the thisArg if set', function(done){
            var wait = waitingOn();
            var callback_called = false;
            
            setTimeout(wait.process('timer', function(){
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
            
            setTimeout(wait.process('timer', function(){
                throw err;
            }, wait), 50);
            
            wait.finally((errors) => {
                expect(errors).to.be.an('array');
                expect(errors).to.deep.equal([err]);
                done();
            });
        });
    });
    
    describe('.processes()', function(){
        it('should add proccesses to the wait list', function(done){
            var all_done = false;
            var wait = waitingOn().processes('a', 'b').finally(() => {
                expect(all_done).to.equal(true);
                done();
            });
            
            wait.finished('a');
            wait.finished('b');
            all_done = true;
        });
        
        it('should be ok with no arguments', function(){
            waitingOn().processes();
        });
        
        it('should be not be ok with non-string or empty string arguments', function(){
            var error_message = /^Process name must be a string with one or more characters$/;
            expect(() => waitingOn().processes(undefined)).to.throw(Error, error_message);
            expect(() => waitingOn().processes('')).to.throw(Error, error_message);
            expect(() => waitingOn().processes(false)).to.throw(Error, error_message);
            expect(() => waitingOn().processes(true)).to.throw(Error, error_message);
            expect(() => waitingOn().processes([])).to.throw(Error, error_message);
            expect(() => waitingOn().processes({})).to.throw(Error, error_message);
            expect(() => waitingOn().processes(function(){})).to.throw(Error, error_message);
            expect(() => waitingOn().processes(() => {})).to.throw(Error, error_message);
            expect(() => waitingOn().processes(1)).to.throw(Error, error_message);
            expect(() => waitingOn().processes(0)).to.throw(Error, error_message);
            expect(() => waitingOn().processes(null)).to.throw(Error, error_message);
        });
        
        it('should not allow adding proccesses if finally has already been called', function(done){
            var wait = new WaitingOn();
            wait.finally(() => {
                expect(() => wait.processes('bad')).to.throw(Error, /^Finally already called\.$/);
                done();
            });
        });
        
        it('should be able to be called multiple times', function(){
            var wait = waitingOn().processes('a', 'b', 'c');
            wait.processes('d','e','f');
            expect(wait.holdup().sort()).to.deep.equal(['a','b','c','d','e','f']);
        });
        
        it('should allow multiple of the same process', function(){
            var wait = waitingOn().processes('a', 'a', 'a');
            expect(wait.holdup()).to.deep.equal(['a']);
            wait.finished('a');
            expect(wait.holdup()).to.deep.equal(['a']);
            wait.finished('a', 'a');
            expect(wait.holdup()).to.equal(0);
        });
    });
    
    describe('finally', function(){
        it('should call its callback when we are no longer waiting on anything', function(done){
            waitingOn().finally(() => {
                done();
            });
        });
        
        it('should not allow calling finally twice', function(){
            expect(() => waitingOn().finally().finally(() => {})).to.throw(Error, /Finally already set!/);
        });
        
        it('should use the thisArg when passed', function(done){
            var wait = new WaitingOn();
            wait.finally(function(){
                expect(this).to.equal(wait);
                done();
            }, wait);
        });
        
        it('should allow a new process/count after the finally is already scheduled for the next tick', function(done){
            var wait = waitingOn(1);
            var second_task = false;
            
            wait.finally(() => {
                expect(second_task).to.equal(true);
                done();
            });
            
            wait.finished();
            
            setTimeout(wait.callback(() => {
                second_task = true;
            }), 100);
        });
    });
    
    it('I need an expect for all finally calls to check for errors');
    it('I need tests for all chainable functions to solidify the expected behavior');
});