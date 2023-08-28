import {markdownTable} from 'markdown-table'

export const parseSwagger = (txt) => {
  try {
    const s = JSON.parse(txt)
    return parse2Md(s)
  } catch (e) {
    console.error(e)
    return e.stack.toString()
  }
}

const parse2Md = (s) => {
  const swagger = new Swagger(s);
  return swagger.md()
}

// eslint-disable-next-line no-unused-vars
class Swagger {
  source = {} //原来的数据
  tags = []
  tagMap = {}
  actions = []
  definitions = []

  constructor(source) {
    this.source = source
    this.tags = source.tags || []
    this.definitions = source.definitions

    this.tags.forEach(item => {
      this.tagMap[item.name] = item
    })

    for (const path in source.paths) {
      for (const method in source.paths[path]) {
        const action = new Action(path, method, source.definitions, source.paths[path][method])
        this.actions.push(action)

        if (!this.tagMap[action.tag]) {
          this.tagMap[action.tag] = {name: action.tag}
          this.tags.push({name: action.tag})
        }
      }


    }
  }

  md() {

    const actionMap = {}

    this.actions.forEach(item => {
      if (!actionMap[item.tag]) {
        actionMap[item.tag] = []
      }
      actionMap[item.tag].push(item)
    })

    const lines = []

    this.tags.forEach(item => {
      lines.push(`# ${item.name} ${item.description || ''}
`)
      actionMap[item.name]?.forEach((item, idx) => {
        lines.push(item.md(idx + 1))
      })
    })

    return lines.join('\n')

  }
}

// eslint-disable-next-line no-unused-vars
class Action {
  summary = '' //标题
  description = ''
  tag = '' //分组
  path = '' //路径
  method = '' //方法
  queries = []
  paths = []
  body = {}
  // parameters //参数
  responses = {} //回复
  response = {}

  defines = {}

  constructor(path, method, defines, {parameters = [], summary, description, responses = {}, tags}) {
    this.summary = summary
    this.description = description
    this.tag = tags[0]
    this.path = path
    this.method = method.toUpperCase()
    this.defines = defines
    parameters.forEach(item => {
      switch (item.in) {
        case "query":
          this.queries.push(item)
          break
        case "path":
          this.paths.push(item)
          break
        case "body":
          this.body = item
          break
      }
    })
    this.responses = responses
    this.response = responses["200"] || {}
    // console.log(method,this.response.schema)
    // console.log(this.responseExampleMD())
  }

  md(idx) {
    return `## ${idx ? idx + ". " : ''}${this.summary || ''}
${this.description ? '> ' + this.description : ''}

\`${this.method} ${this.path}\`

${this.paths.length ?
      `### 请求路径

${this.requestPathMD()}

` : ''}
### 请求参数

${this.requestArgsMD()}

### 请求样例

${this.requestExampleMD()}

### 返回结果
   
${this.responseArgsMD()}

### 返回样例

${this.responseExampleMD()}

`
  }

  requestPathMD() {
    return this.argsMD(this.paths)
  }

  argsMD(list = [], before = '') {
    let lines = [];
    lines.push(["名称", "类型", "必填", "说明", "样例"])
    const mdList = list.map(item => [
      item.paths ? item.paths.join(".").replaceAll(".0", "[0]").replaceAll("0.", "[0]") : item.name,
      getItemType(item),
      item.required ? '是' : '否',
      getItemDes(item).replaceAll('\n', '<br/>'),
      getItemExample(item) || ''
    ])
    lines = lines.concat(mdList)
    return before + markdownTable(lines,
      {
        align: 'left',
        alignDelimiters: true
        , stringLength: (v) => {
          const len = v.split("<br/>").reduce((x, y) => x.length > y.length ? x : y).length
          if (len < 4) {
            return 4
          }
          return len
        }
      })
  }

  requestArgsMD() {
    let before = ""
    let list = [];
    if (this.method === "GET" || this.queries.length) {
      list = this.queries.map(item => this.getBody(item.name, item))
    } else {
      list = this.getBodyList("", this.body.schema)
      const ob = this.getObject(this.body.schema)
      if (ob.externalDocs?.description) {
        before = ` > ${ob.externalDocs?.description}

`;
      }
    }

    return this.argsMD(list, before)
  }

  responseArgsMD() {
    let lines = [];
    lines.push(["名称", "类型", "说明", "样例"])
    const list = this.getBodyList("", this.response.schema)
    const mdList = list.map(item => [
      item.paths.join(".").replaceAll(".0", "[0]").replaceAll("0.", "[0]."),
      getItemType(item),
      getItemDes(item).replaceAll('\n', '<br/>'),
      getItemExample(item) || ''
    ])

    lines = lines.concat(mdList)
    return markdownTable(lines,
      {
        align: 'left',
        alignDelimiters: true
        , stringLength: (v) => {
          const len = v.split("<br/>").reduce((x, y) => x.length > y.length ? x : y).length
          if (len < 4) {
            return 4
          }
          return len
        }
      })
  }

  requestExampleMD() {

    let str = ``
    if (this.method === "GET" || this.queries.length) {
      str = this.queries.map(item => {
        return `${item.name}=${getItemExample(item) || ''}`
      }).join('&')
    } else {
      str = this.getJsonExample(this.body.schema)
    }
    return `\`\`\` json
${str}
\`\`\`
    `
  }

  getJsonExample(ob) {
    const list = this.getBodyList("", ob)
    const object = this.getObject(ob).type === "array" ? [{}] : {}
    list.forEach((item) => {
      // const path = item.paths.join(".").replaceAll(".[", "[")
      let tempObject = object

      item.paths.forEach((path, idx) => {
        if (idx === item.paths.length - 1) {
          return
        }
        tempObject = tempObject[path]
      })
      const example = getItemExample(item)
      switch (item.type) {
        case "object":
          tempObject[item.paths[item.paths.length - 1]] = {}
          break
        case "array":
          switch (item.item.type) {
            case "object":
              // 递归的
              if (item.paths.length > item.item.paths?.length) {
                tempObject[item.paths[item.paths.length - 1]] = []
              } else {
                tempObject[item.paths[item.paths.length - 1]] = [{}]
              }
              // tempObject[item.paths[item.paths.length - 1]] = [{}]
              break
            default:
              tempObject[item.paths[item.paths.length - 1]] = example || [getItemTypeExample(item.item)]
              break
          }
          // tempObject[item.paths[item.paths.length - 1]] = [undefined]
          break
        default:
          tempObject[item.paths[item.paths.length - 1]] = example || getItemTypeExample(item)
      }
    })

    return JSON.stringify(object, null, "  ")
  }

  responseExampleMD() {
    const str = this.getJsonExample(this.response.schema)
    return `\`\`\` json
${str}
\`\`\`
    `
  }

  getDefine(item) {
    return this.defines[item.replace("#/definitions/", "")]
  }

  getBodyList(key, ob = {}) {
    const list = []
    this.getBody(key, ob, [], function (item) {
      list.push(item)
    })

    list.splice(0, 1)
    return list
  }

  getObject(ob = {}) {
    if (ob["$ref"]) {
      return this.getDefine(ob["$ref"])
    }
    return ob
  }

  getBody(key, fromOb = {}, paths = [], callback = () => {
  }, cache = new WeakMap()) {
    const ob = this.getObject(fromOb)

    if (cache.has(ob)) {
      return {
        ...cache.get(ob),
        title: fromOb.title || ob.title,
      };
    }

    const newPaths = key ? paths.concat(key) : paths
    const newOb = {
      ...ob,
      paths: newPaths,
      title: fromOb.title || ob.title,
    };

    if (["object"].includes(ob.type)) {
      cache.set(ob, newOb)
    }

    if (key !== "0") {
      callback && callback(newOb)
    }

    switch (ob.type) {
      case "object":
        newOb.property = {}
        for (const listKey in ob.properties) {
          newOb.property[listKey] = this.getBody(listKey, ob.properties[listKey], newPaths, callback, cache)

          if (newOb.required) {
            newOb.property[listKey].required = newOb.property[listKey].required ?? newOb.required?.includes(listKey)
          }
        }
        break
      case "array":
        newOb.item = this.getBody("0", ob.items, newPaths, callback, cache)
        newOb.item.required = ob.required
        break
    }
    cache.delete(ob)
    return newOb
  }
}

function getItemType({format, type, item = {}, enum: enumerate}) {
  switch (type) {
    case 'integer':
      return enumerate ? 'int32' : format
    case 'array':
      return `[${getItemType(item)}]`
  }
  return format ? `${type}(${format})` : type
}

function getItemDes({title, description = ''}) {
  return title ? title : description
}

function getItemExample({default: def, example, type}) {
  if (typeof def !== 'undefined') {
    return def
  }

  if (typeof example === 'undefined') {
    return example
  }

  if (type === "string") {
    return example.toString()
  }

  return example
}

function getItemTypeExample({example, format, type}) {
  if (typeof example === 'object') {
    return JSON.stringify(example)
  }

  switch (type) {
    case "integer":
      return 0
    case "boolean":
      return false
    case "number":
      // switch (format) {
      //   case "double":
      //   case "float":
      //     return 0.0
      //   default:
      return 0
    // }
    default:
      switch (format) {
        case "int64":
          return "0"
        default:
          return "string"
      }

  }
  // return format ? format : type
}
