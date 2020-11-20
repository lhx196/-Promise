const PENDING = "PENGING";
const RESOLVE = "RESOLVE";
const REJECT = "REJECT";

// 返回值是否为promise执行逻辑
function resolvePromise(promise2, x, resolve, reject) {
  // 不能用同一对象，可能造成死循环
  if (promise2 === x) {
    // promise A+文档规定 同一对象必须抛出TypeError
    return reject(new TypeError("不能引用同一对象"));
  }
  let called
  // 判断then中resolve，reject返回的值的类型，x如果是对象或者函数 说明是一个promise
  if (
    Object.prototype.toString.call(x).indexOf("Object") >= 0 ||
    Object.prototype.toString.call(x).indexOf("Function") >= 0
  ) {
    // 规范中缓存then引用，然后测试，调用，避免多次调用then属性，确保访问器属性的一致性
    try {
      let then = x.then;
      // 如果x存在then方法责为promise类型
      if (typeof then === "function") {
        // 判定为promise时，需要把当前返回promise resolve或reject的结果传递到链式then函数所创建返回的promise对象中，当前返回的promise定义为x
        // x.then注册获取结果后的成功/失败回调并丢到外层then函数链式调用返回的promise对象中
        then.call(
          x,
          // resovle(new Promise())  解决递归调用写法
          (y) => {
            if (called) return
            called = true; resolvePromise(promise2, y, resolve, reject)
          },
          (r) => {
            if (called) return
            called = true; reject(r)
          }
        );
      } else {
        resolve(x);
      }
    } catch (e) {
      if (called) return
      called = true
      reject(e);
    }
  } else {
    // 不是promise对象 抛出普通值
    resolve(x);
  }
}

class Promise {
  constructor(executor) {
    this.status = PENDING; // 默认等待
    this.value = undefined; // resolve成功传递值
    this.reason = undefined; // reject失败传递值
    this.onResolveCallbacks = [];
    this.onRejectCallbacks = [];

    let resolve = (value) => {
      if (this.status === PENDING) {
        this.value = value;
        this.status = RESOLVE;
        this.onResolveCallbacks.forEach((fn) => fn());
      }
    };

    let reject = (reason) => {
      if (this.status === PENDING) {
        this.reason = reason;
        this.status = REJECT;
        this.onRejectCallbacks.forEach((fn) => fn());
      }
    };
    // 立即执行
    try {
      executor(resolve, reject);
    } catch (e) {
      // 执行错误手动传递reject
      reject(e);
    }
  }
  then(onfulfilled, onrejected) {
    // then 默认值 then().then().then(data)  --多次无参数then之后能正常执行
    onfulfilled = typeof onfulfilled === "function" ? onfulfilled : (v) => v;
    onrejected =
      typeof onrejected === "function"
        ? onrejected
        : (err) => {
          throw err;
        };

    //then的链式调用，因此then注册后需要返回一个新的promise，可再次调用then方法进行回调注册
    let promise2 = new Promise((resolve, reject) => {
      if (this.status === RESOLVE) {
        setTimeout(() => {
          // 上一次的then执行结果，传递到下一次的回调内
          // onfulfilled，onrejected回调函数内抛出异常，需要放到reject内
          try {
            let x = onfulfilled(this.value);
            // resolvePromise判断返回值是否promise
            resolvePromise(promise2, x, resolve, reject);
          } catch (e) {
            reject(e);
          }
        }, 0);
      }
      if (this.status === REJECT) {
        setTimeout(() => {
          try {
            let x = onrejected(this.reason);
            //  若onrejected正常返回值，则传递到下个then resolve回调中
            resolvePromise(promise2, x, resolve, reject);
          } catch (e) {
            reject(e);
          }
        }, 0);
      }
      // pending状态下，触发then说明立即执行函数里面存在异步操作，此时reslove，rejcet未触发改变状态,并把resolve，reject回到注册到回调队列中,待异步结束后进行调用
      if (this.status === PENDING) {
        this.onResolveCallbacks.push(() => {
          setTimeout(() => {
            try {
              //   上一个异步操作执行后，把结果传入下一个promise的回调中
              let x = onfulfilled(this.value);
              resolvePromise(promise2, x, resolve, reject);
            } catch (e) {
              reject(e);
            }
          }, 0);
        });
        this.onRejectCallbacks.push(() => {
          setTimeout(() => {
            try {
              let x = onrejected(this.reason);
              //  若onrejected正常返回值，则传递到下个then resolve回调中
              resolvePromise(promise2, x, resolve, reject);
            } catch (e) {
              reject(e);
            }
          }, 0);
        });
      }
    });

    return promise2;
  }
  catch(errCallback) {
    return this.then(_, errCallback);
  }
}


Promise.defer = Promise.deferred = function () {
  let dfd = {};
  dfd.promise = new Promise((resolve, reject) => {
    dfd.resolve = resolve;
    dfd.reject = reject;
  });
  return dfd;
}

module.exports = Promise