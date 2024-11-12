import type MarkdownIt from "markdown-it";
import type { Token } from "markdown-it/index.js";
import pangulib from "pangu";

function getPrevChar(tokens: Token[], index: number) {
  for (let i = index - 1; i >= 0; i--) {
    const { content, type } = tokens[i];
    if (type === "html_inline") return "";
    if (content && content.length) return content.slice(-1)!;
  }
  return "";
}

const escapeHtml = (str: string) =>
  str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// 正则表达式来自 赫蹏增强脚本 https://github.com/sivan/heti
const REG_BD_STOP = `。．，、：；！‼？⁇`;
const REG_BD_SEP = `·・‧`;
const REG_BD_OPEN = `「『（《〈【〖〔［｛`;
const REG_BD_CLOSE = `」』）》〉】〗〕］｝`;
const REG_BD_START = `${REG_BD_OPEN}${REG_BD_CLOSE}`;
const REG_BD_END = `${REG_BD_STOP}${REG_BD_OPEN}${REG_BD_CLOSE}`;
const REG_BD_HALF_OPEN = `“‘`;
const REG_BD_HALF_CLOSE = `”’`;
const REG_BD_HALF_START = `${REG_BD_HALF_OPEN}${REG_BD_HALF_CLOSE}`;

const getWrapper = (classList: string, text: string) =>
  `<punc-spacing class="${classList}">${text}</punc-spacing>`;

const punctuationAdjust = (str: string) =>
  str
    .replace(
      new RegExp(
        `([${REG_BD_STOP}])(?=[${REG_BD_START}])|([${REG_BD_OPEN}])(?=[${REG_BD_OPEN}])|([${REG_BD_CLOSE}])(?=[${REG_BD_END}])`,
        "g"
      ),
      (substr) => getWrapper("punc-half", substr)
    )
    .replace(
      new RegExp(
        `([${REG_BD_SEP}])(?=[${REG_BD_OPEN}])|([${REG_BD_CLOSE}])(?=[${REG_BD_SEP}])`,
        "g"
      ),
      (substr) => getWrapper("punc-quarter", substr)
    )
    .replace(
      new RegExp(
        `([${REG_BD_STOP}])(?=[${REG_BD_HALF_START}])|([${REG_BD_HALF_OPEN}])(?=[${REG_BD_OPEN}])`,
        "g"
      ),
      (substr) => getWrapper("punc-quarter", substr)
    );

const punctuationAdjustStart = (str: string) =>
  str.replace(new RegExp(`^[${REG_BD_OPEN}]`), (substr) =>
    getWrapper(
      substr === "《" ? "punc-before-less" : "punc-before-more",
      substr
    )
  );

interface AutoSpacingConfig {
  /** 在全角汉字与字母、数字间添加空格。默认启用。 */
  pangu?: boolean;
  /** 标点挤压，在多个标点符号间调整空格，并减小行首标点前的空格。需要 CSS。 */
  mojikumi?: boolean;
  /** 额外在行内块两侧添加空格。默认为行内代码块与行内公式启用。 */
  spacingItems?: string[];
}

function mdAutoSpacing(md: MarkdownIt, config: AutoSpacingConfig = {}) {
  const {
    pangu = true,
    mojikumi = false,
    spacingItems = ["code_inline", "math_inline"],
  } = config;

  md.renderer.rules.text = (tokens, index) => {
    let result: string;
    if (pangu) {
      const prevChar = getPrevChar(tokens, index);
      result = punctuationAdjust(
        escapeHtml(
          pangulib
            .spacing(prevChar + tokens[index].content)
            .slice(prevChar.length)
        )
      );
    } else {
      result = escapeHtml(tokens[index].content);
    }
    if (
      mojikumi &&
      (typeof tokens[index - 1] === "undefined" ||
        tokens[index - 1].type === "softbreak")
    )
      return punctuationAdjustStart(result);
    else return result;
  };

  spacingItems.forEach((item) => {
    const orig = md.renderer.rules[item];
    if (typeof orig !== "function") {
      console.error("找不到需要添加空格的 rule:", item);
      return;
    }
    md.renderer.rules[item] = (tokens, index, options, env, self) => {
      const content = tokens[index].content || "";
      const prevChar = getPrevChar(tokens, index);
      const prefix = pangulib
        .spacing(prevChar + content.charAt(0))
        .slice(prevChar.length, -1);
      return prefix + orig(tokens, index, options, env, self);
    };
  });
}

export = mdAutoSpacing;
