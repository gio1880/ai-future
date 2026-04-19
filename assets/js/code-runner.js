/* ============================================================
   AI Future Code Lab — Python Code Runner (Skulpt-based)
   ============================================================ */

(function () {
  let isRunning = false;

  function initCodeRunner(options) {
    const {
      editorId   = 'code-editor',
      outputId   = 'code-output',
      runBtnId   = 'run-btn',
      resetBtnId = 'reset-btn',
      successId  = 'success-callout',
      defaultCode = '',
    } = options || {};

    const editor   = document.getElementById(editorId);
    const output   = document.getElementById(outputId);
    const runBtn   = document.getElementById(runBtnId);
    const resetBtn = document.getElementById(resetBtnId);
    const success  = document.getElementById(successId);

    if (!editor || !output || !runBtn) return;

    const original = editor.value || defaultCode;

    runBtn.addEventListener('click', runCode);
    editor.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runCode();
      }
      // Tab support
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = editor.selectionStart;
        const end   = editor.selectionEnd;
        editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 4;
        updateLineNumbers();
      }
    });

    editor.addEventListener('input', updateLineNumbers);
    updateLineNumbers();

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        editor.value = original;
        output.textContent = '';
        output.className = 'output-body output-body--empty';
        output.textContent = '// Output will appear here after you click Run';
        if (success) success.style.display = 'none';
        updateLineNumbers();
      });
    }

    function updateLineNumbers() {
      const lineNumEl = document.getElementById('line-numbers');
      if (!lineNumEl) return;
      const lines = editor.value.split('\n').length;
      lineNumEl.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('<br>');
    }

    function runCode() {
      if (isRunning) return;
      isRunning = true;

      output.className = 'output-body';
      output.textContent = '';
      if (success) success.style.display = 'none';

      runBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size:.75rem"></i> Running…';
      runBtn.disabled = true;

      const code = editor.value;

      // Check if Skulpt is available (loaded from CDN)
      if (window.Sk) {
        runWithSkulpt(code);
      } else {
        // Fallback: simulate output for known demo code
        runSimulated(code);
      }
    }

    function runWithSkulpt(code) {
      let outputBuffer = '';

      function builtinRead(x) {
        if (Sk.builtinFiles === undefined || Sk.builtinFiles.files[x] === undefined) {
          throw new Error("File not found: '" + x + "'");
        }
        return Sk.builtinFiles.files[x];
      }

      Sk.configure({
        output: (text) => {
          outputBuffer += text;
          output.textContent = outputBuffer;
          output.className = 'output-body';
        },
        read: builtinRead,
        __future__: Sk.python3,
        execLimit: 5000,
      });

      Sk.misceval.asyncToPromise(() =>
        Sk.importMainWithBody('<stdin>', false, code, true)
      ).then(() => {
        finishRun(true, outputBuffer);
      }).catch((err) => {
        const msg = err.toString();
        output.textContent = outputBuffer + '\n' + msg;
        output.className = 'output-body output-error';
        finishRun(false, msg);
      });
    }

    function runSimulated(code) {
      // Simple simulation for demo / offline use
      setTimeout(() => {
        try {
          const result = simulatePython(code);
          output.textContent = result.output;
          output.className = 'output-body' + (result.error ? ' output-error' : '');
          finishRun(!result.error, result.output);
        } catch (e) {
          output.textContent = 'Error: ' + e.message;
          output.className = 'output-body output-error';
          finishRun(false, e.message);
        }
      }, 400);
    }

    function finishRun(ok, out) {
      isRunning = false;
      runBtn.innerHTML = '<i class="fa-solid fa-play" style="font-size:.75rem"></i> Run';
      runBtn.disabled = false;

      if (ok && success) {
        success.style.display = 'flex';
      }
      // Update lesson steps if present
      updateLessonStep(3);
    }
  }

  /* ── Simple Python Simulator (for offline/demo) ─────────── */
  function simulatePython(code) {
    const lines = code.split('\n');
    const variables = {};
    let outputLines = [];
    let error = false;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;

      // Variable assignment: name = value
      const assignMatch = line.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
      if (assignMatch && !line.startsWith('print')) {
        const varName = assignMatch[1];
        let valStr = assignMatch[2].trim();
        // Evaluate f-strings and expressions
        variables[varName] = evalValue(valStr, variables);
        continue;
      }

      // print(...)
      const printMatch = line.match(/^print\((.+)\)$/);
      if (printMatch) {
        const args = parsePrintArgs(printMatch[1], variables);
        outputLines.push(args);
        continue;
      }

      // for loop (simple)
      const forMatch = line.match(/^for\s+(\w+)\s+in\s+range\((\d+)(?:,\s*(\d+))?\)\s*:/);
      if (forMatch) {
        const loopVar = forMatch[1];
        const start = forMatch[3] ? parseInt(forMatch[2]) : 0;
        const end   = forMatch[3] ? parseInt(forMatch[3]) : parseInt(forMatch[2]);
        // Collect loop body
        const body = [];
        let j = i + 1;
        while (j < lines.length && (lines[j].startsWith('    ') || lines[j].startsWith('\t'))) {
          body.push(lines[j].trim());
          j++;
        }
        for (let k = start; k < end; k++) {
          variables[loopVar] = k;
          body.forEach(bodyLine => {
            if (bodyLine.startsWith('#')) return;
            const pm = bodyLine.match(/^print\((.+)\)$/);
            if (pm) outputLines.push(parsePrintArgs(pm[1], variables));
          });
        }
        i = j - 1;
        continue;
      }
    }

    return { output: outputLines.join('\n'), error };
  }

  function evalValue(str, vars) {
    str = str.trim();
    // String literal
    if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
      return str.slice(1, -1);
    }
    // f-string
    if (str.startsWith('f"') || str.startsWith("f'")) {
      let s = str.slice(2, -1);
      return s.replace(/\{(\w+)\}/g, (_, v) => vars[v] !== undefined ? vars[v] : v);
    }
    // Number
    if (!isNaN(str)) return parseFloat(str);
    // Variable reference
    if (vars[str] !== undefined) return vars[str];
    // Arithmetic
    try {
      const safe = str.replace(/[a-zA-Z_]\w*/g, m => vars[m] !== undefined ? vars[m] : m);
      return Function('"use strict"; return (' + safe + ')')();
    } catch { return str; }
  }

  function parsePrintArgs(argsStr, vars) {
    // Handle sep='...' kwargs
    argsStr = argsStr.replace(/,?\s*sep=["'].*?["']/, '');
    argsStr = argsStr.replace(/,?\s*end=["'].*?["']/, '');

    const parts = splitArgs(argsStr);
    return parts.map(p => {
      const v = evalValue(p.trim(), vars);
      return v !== undefined ? String(v) : p.trim();
    }).join(' ');
  }

  function splitArgs(str) {
    const parts = [];
    let depth = 0, start = 0, inStr = false, strChar = '';
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (!inStr && (c === '"' || c === "'")) { inStr = true; strChar = c; }
      else if (inStr && c === strChar && str[i-1] !== '\\') { inStr = false; }
      else if (!inStr && (c === '(' || c === '[')) depth++;
      else if (!inStr && (c === ')' || c === ']')) depth--;
      else if (!inStr && depth === 0 && c === ',') {
        parts.push(str.slice(start, i));
        start = i + 1;
      }
    }
    parts.push(str.slice(start));
    return parts;
  }

  /* ── Lesson Step Tracker ─────────────────────────────────── */
  function updateLessonStep(activeStep) {
    document.querySelectorAll('.step-item').forEach((el, idx) => {
      if (idx < activeStep - 1) {
        el.dataset.state = 'done';
        el.querySelector('.step-dot')?.classList.replace('step-dot--active', 'step-dot--done');
        el.querySelector('.step-dot')?.classList.replace('step-dot--todo', 'step-dot--done');
      } else if (idx === activeStep - 1) {
        el.dataset.state = 'active';
        el.querySelector('.step-dot')?.classList.add('step-dot--active');
      }
    });
  }

  // Export
  window.AIFutureCodeRunner = { init: initCodeRunner };
})();
