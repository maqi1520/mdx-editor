import React from 'react'
import * as runtime from 'react/jsx-runtime'
import * as Babel from '@babel/standalone'
import { evaluate } from '@mdx-js/mdx'
import { MDXProvider, useMDXComponents } from '@mdx-js/react'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkToc from 'remark-toc'
import ReactDOMServer from 'react-dom/server'
import { validateReactComponent } from '../utils/validateJavaScript'
import { MDXComponents } from '../components/MDX/MDXComponents'
import { VFile } from 'vfile'
import { VFileMessage } from 'vfile-message'
import rehypeDivToSection from '../components/utils/rehype-div'
import reHypeLinkFoot from '../components/utils/rehype-link-foot'

export const compileMdx = async (jsx, mdx) => {
  let err = null
  let html = null
  let RootComponents = {}

  if (jsx) {
    try {
      //jsx 先通过编译成js
      let res = Babel.transform(jsx, { presets: ['react'] })
      let code = res.code.replace('export default ', 'return ')

      // eslint-disable-next-line no-new-func
      RootComponents = Function('React', code)(React)
      if (!validateReactComponent(RootComponents)) {
        return {
          error: {
            message: 'not react component',
            file: 'Config',
          },
        }
      }
    } catch (error) {
      return {
        error: {
          message: error,
          file: 'Config',
        },
      }
    }
  }

  const file = new VFile({ basename: 'index.mdx', value: mdx })

  // const capture = (name) => (opt) => (tree) => {
  //   file.data[name] = tree;
  // };

  const remarkPlugins = []

  remarkPlugins.push(remarkGfm)
  remarkPlugins.push(remarkFrontmatter)
  remarkPlugins.push(remarkMath)
  //remarkPlugins.push(remarkLinkFoot)
  remarkPlugins.push(() =>
    remarkToc({
      heading: '目录',
      maxDepth: 2,
    })
  )

  //remarkPlugins.push(capture('mdast'))

  try {
    const { default: Content } = await evaluate(mdx, {
      ...runtime,
      format: 'mdx',
      useDynamicImport: true,
      remarkPlugins,
      rehypePlugins: [rehypeDivToSection, reHypeLinkFoot, rehypeKatex],
      //recmaPlugins: [capture('esast')],
      useMDXComponents,
    })
    html = ReactDOMServer.renderToString(
      <MDXProvider components={{ ...MDXComponents, ...RootComponents }}>
        <Content />
      </MDXProvider>
    )
  } catch (error) {
    const message =
      error instanceof VFileMessage ? error : new VFileMessage(error)
    message.fatal = true
    if (!file.messages.includes(message)) {
      file.message(message)
    }

    let errorMessage = file.messages[0].message
    err = {
      message: errorMessage,
      file: 'MDX',
    }
  }

  return {
    err,
    html,
  }
}
