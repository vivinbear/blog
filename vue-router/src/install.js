import View from './components/view'
import Link from './components/link'

// 导出一个Vue的引用,为的是在不将Vue打包到插件内的情况下,可以使用Vue的一些方法
export let _Vue

export function install(Vue) {
  // 这里传入的Vue是框架,并非实例
  // 这里的install就是上面的函数install, 如果是第一次安装,那么installed为undefined,如果已经安装的话installed为true,避免重复安装
  if (install.installed) return
  install.installed = true

  _Vue = Vue
  // 因为Vue中,每一个组件都是Vue的实例,所以可以通过扩展Vue.prototype来实现让每一个组件通过原型访问到$router和$route
  Object.defineProperty(Vue.prototype, '$router', {
    get() { return this.$root._router }
  })

  Object.defineProperty(Vue.prototype, '$route', {
    get() { return this.$root._route }
  })

  Vue.mixin({
    // 每个组件都会执行,但只有在根组件的$options才会存在router
    beforeCreate() {
      // 这里的this是vue实例
      // 判断有没有router,有的化进行router的初始化
      if (this.$options.router) {
        // 和上面15行的 代码相呼应,将router赋值给_router,这样就可以在原型上访问到$router了
        this._router = this.$options.router
        // 调用VueRouter的init方法
        this._router.init(this)
        Vue.util.defineReactive(this, '_route', this._router.history.current)
      }
    }
  })
  // 注册组件
  Vue.component('router-view', View)
  Vue.component('router-link', Link)

  const strats = Vue.config.optionMergeStrategies
  // use the same hook merging strategy for route hooks
  strats.beforeRouteEnter = strats.beforeRouteLeave = strats.created
}
