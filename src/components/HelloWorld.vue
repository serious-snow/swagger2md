<template>
  <div class="hello" style="width: 100%">
    <div style="display: flex;flex-direction: row">
      <input style="height: 30px;width: 700px;" type="text" v-model="swaggerUrl" placeholder="输入swagger.json地址"/>
      <button style="margin-left: 10px" @click="getUrl" :disabled="!swaggerUrl">获取swagger</button>
      <button style="margin-left: 10px" @click="parseFun" :disabled="!inputJs">转换为markdown</button>
      <div style="margin-left: 10px;height: 30px;display:flex;align-items:center;cursor:pointer;user-select:none">
        <input type="checkbox" id="input_preview" v-model="preview"/>
        <label for="input_preview">markdown预览</label>
      </div>

    </div>
    <div style="width: 100%;display: flex;margin-top: 20px">
      <div style="flex:1">
        <textarea style="width: 100%;resize:vertical" rows="30" v-model="inputJs"
                  placeholder="输入swagger内容"></textarea>
      </div>
      <div style="flex:1">
        <textarea style="width:100%;resize:vertical" readonly rows="30" v-model="outputJs"></textarea>
      </div>
    </div>
    <div style="width: 100%; display: flex;flex-direction: row;text-align: left;margin-top: 10px">
      <!--      <highlightjs autodetect :code="mdHtml"/>-->
      <!--      <Markdown :highlight="hljs" :source="mdHtml" />-->
      <div class="markdown-body" v-show="preview" v-html="mdHtml"></div>
    </div>


  </div>
</template>

<script setup>

import {ref, watch} from "vue";
import {parseSwagger} from "@/utils/swagger";
import MarkdownIt from "markdown-it";
import MarkdownItAttrs from 'markdown-it-attrs';
// import Markdown from 'vue3-markdown-it';
// import * as MarkdownIt from "markdown-it"
import hljs from "highlight.js";

const getStorageItem = (key) => {
  return localStorage.getItem(key)
}
const setStorageItem = (key, value) => {
   localStorage.setItem(key, value)
}

const SWAGGER_URL_KEY = "SWAGGER_URL"
const SWAGGER_INPUT_KEY = "SWAGGER_INPUT"
const SWAGGER_PREVIEW = "SWAGGER_PREVIEW"

const swaggerUrl = ref(getStorageItem(SWAGGER_URL_KEY))
const inputJs = ref(getStorageItem(SWAGGER_INPUT_KEY))
const preview = ref(JSON.parse(getStorageItem(SWAGGER_PREVIEW)))
const outputJs = ref("")
const mdHtml = ref("")

const getUrl = () => {
  setStorageItem(SWAGGER_URL_KEY, swaggerUrl.value)
  fetch(swaggerUrl.value).then(res => res.text()).then(res => {
    inputJs.value = res
  }).catch(e => {
    outputJs.value = e.stack.toString()
  })
}

watch(preview, function (current) {
  setStorageItem(SWAGGER_PREVIEW, JSON.stringify(current))
})

const md = new MarkdownIt({
  html: true,
  typographer: false,
  langPrefix: 'language-',
  _highlight: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="hljs"><code>' +
            hljs.highlight(str, {language: lang, ignoreIllegals: true}).value +
            '</code></pre>';
        // eslint-disable-next-line no-empty
      } catch (__) {

      }
    }

    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
  }
}).use(MarkdownItAttrs);
const parseFun = () => {
  setStorageItem(SWAGGER_INPUT_KEY, inputJs.value)
  outputJs.value = parseSwagger(inputJs.value)
  mdHtml.value = md.render(outputJs.value)
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
h3 {
  margin: 40px 0 0;
}

ul {
  list-style-type: none;
  padding: 0;
}

li {
  display: inline-block;
  margin: 0 10px;
}

a {
  color: #42b983;
}

</style>
