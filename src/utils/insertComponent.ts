/**
 * 在光标位置插入 React 组件的工具函数
 * 
 * 注意：此函数依赖 VSCode 的编辑器 API，仅能在 VSCode 编辑器环境中使用。
 * 需要通过 VSCode 插件 API 才能访问编辑器状态。
 * 
 * 用法示例：
 * import { insertComponentAtCursor } from '@/utils/insertComponent';
 * 
 * // 插入一个 Card 组件
 * insertComponentAtCursor(`
 *   <Card title="我的卡片" extra={<span>操作</span>}>
 *     <div className={styles.cardContent}>
 *       <p>这是卡片内容</p>
 *       <Button onClick={handleClick}>点击我</Button>
 *     </div>
 *   </Card>
 * `);
 */

import * as vscode from 'vscode';

/**
 * 获取当前 VSCode 活动编辑器的文件路径
 * @returns 文件路径或 null
 */
function getCurrentFilePath(): string | null {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    console.warn('未检测到活动的文本编辑器');
    return null;
  }
  return editor.document.uri.fsPath;
}

/**
 * 获取当前 VSCode 光标位置
 * @returns 光标位置信息
 */
function getCurrentCursorPosition(): vscode.Position | null {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return null;
  }
  return editor.selection.active;
}

/**
 * 显示消息
 * @param message - 消息内容
 * @param type - 消息类型
 */
function showMessage(message: string, type: vscode.MessageType = vscode.MessageType.Info) {
  vscode.window.showInformationMessage(message);
}

/**
 * 读取文件内容
 * @param uri - 文件 URI
 * @returns 文件内容
 */
function readFileContent(uri: vscode.Uri): Promise<string> {
  return vscode.workspace.fs.readFile(uri).then((data: Uint8Array) => {
    return new TextDecoder('utf-8').decode(data);
  });
}

/**
 * 写入文件内容
 * @param uri - 文件 URI
 * @param content - 文件内容
 */
function writeFileContent(uri: vscode.Uri, content: string): Promise<undefined> {
  return vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
}

/**
 * 在光标位置插入 React 组件节点
 * 
 * @param componentElement - 要插入的 React 组件 JSX 代码（支持多行字符串模板）
 * @param options - 配置选项
 * @param options.indent - 缩进次数（默认为 2，即 4 个空格）
 * @param options.addComment - 是否添加注释说明（默认为 true）
 * @param options.beforeTagName - 在哪个标签前插入，支持：'return'（默认）、'useState'、'useEffect' 等
 * @returns 插入结果信息
 */
export function insertComponentAtCursor(
  componentElement: string,
  options: {
    indent?: number;
    addComment?: boolean;
    beforeTagName?: string;
  } = {}
): { success: boolean; message: string; filePath: string | null } {
  const {
    indent = 2,
    addComment = true,
    beforeTagName = 'return',
  } = options;

  const filePath = getCurrentFilePath();

  if (!filePath) {
    vscode.window.showWarningMessage('请确保正在编辑一个 .tsx/.ts/.jsx/.js 文件');
    return {
      success: false,
      message: '请确保正在编辑一个 .tsx/.ts/.jsx/.js 文件',
      filePath: null,
    };
  }

  // 检查文件扩展名
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (!['tsx', 'ts', 'jsx', 'js'].includes(ext || '')) {
    vscode.window.showWarningMessage(`文件 ${filePath} 不是支持的类型（.tsx/.ts/.jsx/.js）`);
    return {
      success: false,
      message: `文件 ${filePath} 不是支持的类型（.tsx/.ts/.jsx/.js）`,
      filePath,
    };
  }

  // 获取文件 URI
  const uri = vscode.Uri.file(filePath);

  // 读取文件内容
  readFileContent(uri).then((content) => {
    // 确保文件以换行符结尾
    if (!content.endsWith('\n')) {
      content += '\n';
    }

    // 获取当前光标位置
    const cursorPos = getCurrentCursorPosition();
    if (!cursorPos) {
      showMessage('无法获取光标位置', vscode.MessageType.Error);
      return {
        success: false,
        message: '无法获取光标位置',
        filePath,
      };
    }

    // 将光标位置转换为行号（从 0 开始）
    const lineIndex = cursorPos.line;

    // 读取光标所在行的内容
    const lines = content.split('\n');
    const currentLine = lines[lineIndex] || '';

    // 计算当前行的缩进量（空格数）
    const indentMatch = currentLine.match(/^\s*/);
    const currentLineIndent = indentMatch ? indentMatch[0].length : 0;

    // 计算缩进字符串
    const indentStr = ' '.repeat(indent);

    // 处理要插入的组件代码，确保每行都有正确的缩进
    const componentLines = componentElement.split('\n');
    const linesToInsert: string[] = [];

    for (let i = 0; i < componentLines.length; i++) {
      const line = componentLines[i];
      // 如果行不为空，添加缩进
      if (line.trim()) {
        linesToInsert.push(indentStr + line);
      } else {
        linesToInsert.push('');
      }
    }

    // 生成要插入的组件代码
    const insertLines: string[] = [];

    // 添加注释（如果启用）
    if (addComment) {
      const commentText = beforeTagName === 'return' ? '插入的组件' : `在 ${beforeTagName} 前插入`;
      insertLines.push(indentStr + `// ${commentText}`);
    }

    // 添加组件代码
    insertLines.push(...linesToInsert);

    // 构建插入文本
    const insertText = insertLines.join('\n');

    // 构建光标行之前的内容（不包含光标行）
    const linesBefore = lines.slice(0, lineIndex).join('\n');
    // 构建光标行之后的内容（不包含光标行本身）
    const linesAfter = lines.slice(lineIndex + 1).join('\n');

    // 组合最终内容
    const newContent = linesBefore + insertText + '\n' + linesAfter;

    // 写入文件
    writeFileContent(uri, newContent).then(() => {
      // 显示成功消息
      vscode.window.showInformationMessage('组件已插入成功！');
    }).catch((err) => {
      console.error('写入文件失败:', err);
      vscode.window.showErrorMessage(`写入文件失败：${err.message}`);
    });

    return {
      success: true,
      message: `组件已插入到文件 ${filePath}`,
      filePath,
    };
  }).catch((err) => {
    console.error('读取文件失败:', err);
    vscode.window.showErrorMessage(`读取文件失败：${err instanceof Error ? err.message : String(err)}`);
    return {
      success: false,
      message: `读取文件失败：${err instanceof Error ? err.message : String(err)}`,
      filePath,
    };
  });

  // 返回一个 placeholder，因为这是异步操作
  return {
    success: true,
    message: '正在处理插入操作...',
    filePath,
  };
}
