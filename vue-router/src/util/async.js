/* @flow */

export function runQueue(queue: Array<?NavigationGuard>, fn: Function, cb: Function) {
  const step = index => {
    // 如果说当前index等于队列的长度,说明队列执行完毕
    if (index >= queue.length) {
      cb()
    } else {
      if (queue[index]) {
        // 如果存在的话,调用传入的迭代函数
        fn(queue[index], () => {
          step(index + 1)
        })
      } else {
        // 不存在,则继续队列的下一个
        step(index + 1)
      }
    }
  }
  step(0)
}
