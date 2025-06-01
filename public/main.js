function convertScript() {
  inputStr = document.querySelector("#githubScript").value;
  if (inputStr == "") {
    return;
  }

  ghproxy = document.querySelector("#ghproxy").value;
  perlcmdbegin = ' | perl -pe "$(curl -L ';
  perlcmdend = ')"';
  perlrule = ghproxy + 'perl-pe-para';

  // 先给裸的git类链接前面加上 https://
  inputStr = inputStr.replace(/ git/g, ' https://git');

  // 再进行加github proxy的转换
  // 处理 bash <( curl xxx.sh) 或 bash <( wget -O- xxx.sh)
  regex1 = /(bash.*?)(https?:\/\/.*?)(\).*)/s;

  // 考虑github脚本嵌套调用的情况, 即A脚本调用B脚本, B脚本调用C脚本
  replacement1 = '$1' + ghproxy + '$2' + perlcmdbegin + perlrule + perlcmdend + '$3';
  resultStr1 = inputStr.replace(regex1, replacement1);
  if (resultStr1 !== inputStr) {
    document.querySelector("#result1").value = resultStr1;
  }

  // 只考虑处理一层Github脚本的情况
  replacement2 = '$1' + ghproxy + '$2' + ' | perl -pe "s#(http.*?git[^/]*?/)#' + ghproxy + '\\1#g"' + '$3';
  resultStr2 = inputStr.replace(regex1, replacement2);
  if (resultStr2 !== inputStr) {
    document.querySelector("#result2").value = resultStr2;
  }

  // 处理 wget xxx.sh && bash xxx.sh 或 wget xxx.sh && chmod +x xxx.sh && ./xxx.sh
  regex2 = /(wget.*?)(https?:\/\/.*)(&&[^&]*[ /])(.*?sh)/s;
  //replacement3 = '1 : $1 ; 2 : $2 ; 3 : $3 ; 4 : $4 ;'
  replacement3 = '$1' + ghproxy + '$2' + '&& perl -i -pe "s#(http.*?git[^/]*?/)#' + ghproxy + '\\1#g" ' + '$4 $3$4';
  resultStr2 = inputStr.replace(regex2, replacement3);
  if (resultStr2 !== inputStr) {
    document.querySelector("#result2").value = resultStr2;
  }

  // 处理 curl -sS -O xxx.sh && bash xxx.sh 或 curl -sS -O xxx.sh && chmod +x xxx.sh && bash xxx.sh 
  regex2 = /^(curl.*?)(https?:\/\/.*)(&&[^&]*[ /])(.*?sh)/s;
  //replacement3 = '1 : $1 ; 2 : $2 ; 3 : $3 ; 4 : $4 ;'
  replacement3 = '$1' + ghproxy + '$2' + '&& perl -i -pe "s#(http.*?git[^/]*?/)#' + ghproxy + '\\1#g" ' + '$4 $3$4';
  resultStr2 = inputStr.replace(regex2, replacement3);
  if (resultStr2 !== inputStr) {
    document.querySelector("#result2").value = resultStr2;
  }
}

function copyResult1() {
  resultStr = document.querySelector("#result1").value;
  navigator.clipboard.writeText(resultStr);
}

function copyResult2() {
  resultStr = document.querySelector("#result2").value;
  navigator.clipboard.writeText(resultStr);
}

function getLocalUrl() {
  document.querySelector("#ghproxy").value = window.location.href;
}

function convertRes() {
  inputStr = document.querySelector("#githubRes").value;
  if (inputStr == "") {
    return;
  }

  ghproxy = document.querySelector("#ghproxy").value;

  // 先给裸的git类链接前面加上 https://
  inputStr = inputStr.replace(/ git/g, ' https://git');

  resultStr = ghproxy + inputStr;

  document.querySelector("#resAfterGhproxy").value = resultStr;
}

function fetchRes() {
  window.open(document.querySelector("#resAfterGhproxy").value);
}

// 短链接功能相关代码
// 模式切换函数
function switchToSingleMode() {
  document.getElementById('singleMode').classList.remove('hidden');
  document.getElementById('bulkMode').classList.add('hidden');
  document.getElementById('singleModeBtn').classList.add('bg-indigo-600', 'text-white');
  document.getElementById('singleModeBtn').classList.remove('bg-gray-300');
  document.getElementById('bulkModeBtn').classList.add('bg-gray-300');
  document.getElementById('bulkModeBtn').classList.remove('bg-indigo-600', 'text-white');
}

function switchToBulkMode() {
  document.getElementById('singleMode').classList.add('hidden');
  document.getElementById('bulkMode').classList.remove('hidden');
  document.getElementById('bulkModeBtn').classList.add('bg-indigo-600', 'text-white');
  document.getElementById('bulkModeBtn').classList.remove('bg-gray-300');
  document.getElementById('singleModeBtn').classList.add('bg-gray-300');
  document.getElementById('singleModeBtn').classList.remove('bg-indigo-600', 'text-white');
}

// 添加模式切换事件监听器
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('singleModeBtn').addEventListener('click', switchToSingleMode);
  document.getElementById('bulkModeBtn').addEventListener('click', switchToBulkMode);
});

// 验证URL是否为GitHub相关链接
function validateGitHubUrl(url) {
  // 使用与后端相同的正则表达式
  const exp1 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:releases|archive)\/.*$/i;
  const exp2 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:blob|raw)\/.*$/i;
  const exp3 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:info|git-).*$/i;
  const exp4 = /^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+?\/.+$/i;
  const exp5 = /^(?:https?:\/\/)?gist\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+$/i;
  const exp6 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/tags.*$/i;
  const exp7 = /^(?:https?:\/\/)?api\.github\.com\/.*$/i;
  const exp8 = /^(?:https?:\/\/)?git\.io\/.*$/i;
  const exp9 = /^(?:https?:\/\/)?gitlab\.com\/.*$/i;
  
  return (
    exp1.test(url) || exp2.test(url) || exp3.test(url) || 
    exp4.test(url) || exp5.test(url) || exp6.test(url) || 
    exp7.test(url) || exp8.test(url) || exp9.test(url)
  );
}

// 复制到剪贴板
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('已复制到剪贴板');
  }).catch(err => {
    console.error('复制失败:', err);
  });
}

// 生成单个短链接
async function generateShortUrl() {
  const longUrl = document.getElementById('longUrl').value.trim();
  if (!longUrl) {
    alert('请输入GitHub链接');
    return;
  }
  
  if (!validateGitHubUrl(longUrl)) {
    alert('请输入有效的GitHub链接');
    return;
  }
  
  // 显示加载状态
  const resultArea = document.getElementById('resultArea');
  resultArea.classList.remove('hidden');
  resultArea.innerHTML = '<div class="text-center p-2">处理中...</div>';
  
  try {
    const response = await fetch('/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: longUrl })
    });
    
    const result = await response.json();
    
    if (result.error) {
      resultArea.innerHTML = `<div class="text-red-500 p-2">${result.error}</div>`;
      return;
    }
    
    resultArea.innerHTML = `
      <div class="p-2 border rounded-md bg-gray-50">
        <label class="block text-sm font-medium mb-1">短链接</label>
        <div class="flex">
          <input type="text" value="${result.shortUrl}" class="flex-grow px-3 py-2 border rounded-l-md" readonly>
          <button onclick="copyToClipboard('${result.shortUrl}')" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-r-md transition duration-200">
            复制
          </button>
        </div>
        <p class="text-xs text-gray-500 mt-1">此链接将直接返回内容，适合在脚本中使用</p>
      </div>
    `;
  } catch (error) {
    resultArea.innerHTML = `<div class="text-red-500 p-2">处理失败: ${error.message}</div>`;
  }
}

// 生成批量短链接
async function generateBulkShortUrls() {
  const bulkUrls = document.getElementById('bulkUrls').value.trim().split('\n')
    .map(url => url.trim())
    .filter(url => url.length > 0);
  
  if (bulkUrls.length === 0) {
    alert('请输入至少一个GitHub链接');
    return;
  }
  
  if (bulkUrls.length > 50) {
    alert('一次最多处理50个链接');
    return;
  }
  
  // 显示加载状态
  const resultArea = document.getElementById('resultArea');
  resultArea.classList.remove('hidden');
  resultArea.innerHTML = '<div class="text-center p-2">处理中...</div>';
  
  try {
    const response = await fetch('/api/shorten-bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: bulkUrls })
    });
    
    const results = await response.json();
    
    if (results.error) {
      resultArea.innerHTML = `<div class="text-red-500 p-2">${results.error}</div>`;
      return;
    }
    
    // 创建结果表格
    let tableHtml = `
      <div class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="bg-gray-100">
              <th class="border p-2 text-left">原始链接</th>
              <th class="border p-2 text-left">短链接</th>
              <th class="border p-2 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    results.forEach(result => {
      tableHtml += `
        <tr class="${result.status === 'error' ? 'bg-red-50' : ''}">
          <td class="border p-2 break-all">${result.originalUrl}</td>
          <td class="border p-2 break-all">
            ${result.status === 'success' 
              ? result.shortUrl 
              : `<span class="text-red-500">${result.error}</span>`}
          </td>
          <td class="border p-2 text-center">
            ${result.status === 'success' 
              ? `<button onclick="copyToClipboard('${result.shortUrl}')" class="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition duration-200">复制</button>`
              : ''}
          </td>
        </tr>
      `;
    });
    
    tableHtml += `
          </tbody>
        </table>
      </div>
      <button onclick="exportToCsv()" class="mt-2 px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-md transition duration-200">导出CSV</button>
    `;
    
    resultArea.innerHTML = tableHtml;
    
    // 保存结果到window对象，用于导出CSV
    window.bulkResults = results;
    
  } catch (error) {
    resultArea.innerHTML = `<div class="text-red-500 p-2">处理失败: ${error.message}</div>`;
  }
}

// 导出CSV功能
function exportToCsv() {
  if (!window.bulkResults || window.bulkResults.length === 0) {
    return;
  }
  
  let csvContent = "原始链接,短链接\n";
  
  window.bulkResults.forEach(result => {
    if (result.status === 'success') {
      csvContent += `"${result.originalUrl}","${result.shortUrl}"\n`;
    }
  });
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "github_short_urls.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

getLocalUrl()
