import Vue from 'vue'
import VueRouter from 'vue-router'

/* 1. 安装插件
      注册<router-view> <router-link>组件
*/
Vue.use(VueRouter)

// 2. 定义路由组件
const Home = { template: '<div>home</div>' }
const Foo = { template: '<div>foo</div>' }
const Bar = { template: '<div>bar</div>' }

// 3. 实例化VueRouter
const router = new VueRouter({
  mode: 'history',
  base: __dirname,
  routes: [
    { path: '/', component: Home, name: 'home' },
    { path: '/foo', component: Foo, name: 'foo' },
    { path: '/bar', component: Bar, name: 'bar' }
  ]
})

// 4. 创建、启动应用
// 一定要确认注入了 router
// 在 <router-view> 中将会渲染路由组件
new Vue({
  router,
  template: `
    <div id="app">
      <h1>Basic</h1>
      <ul>
        <li><router-link to="/">/</router-link></li>
        <li><router-link to="/foo">/foo</router-link></li>
        <li><router-link to="/bar">/bar</router-link></li>
        <router-link tag="li" to="/bar">/bar</router-link>
      </ul>
      <router-view class="view"></router-view>
    </div>
  `
}).$mount('#app')
