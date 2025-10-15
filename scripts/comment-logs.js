const fs = require('fs');
const path = require('path');

// Directories to process
const directories = [
  'src/Controllers',
  'src/Services',
  'src/Utils',
  'src/Queues',
  'src/Middlewares',
  'src/Sockets',
  'src/Models',
  'src/Config',
  'src'
];

// Regex patterns to match console statements
const consolePatterns = [
  /^(\s*)(console\.(log|error|warn|info|debug)\([^;]*\);?)$/gm,
  /^(\s*)(console\.(log|error|warn|info|debug)\([\s\S]*?\);?)$/gm
];

let filesProcessed = 0;
let linesCommented = 0;

function commentOutConsoleLogs(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let modified = false;

    // First pass: single-line console statements
    content = content.replace(
      /^(\s*)(console\.(log|error|warn|info|debug)\([^)]*\);?)$/gm,
      (match, indent, statement) => {
        linesCommented++;
        modified = true;
        return `${indent}// ${statement}`;
      }
    );

    // Second pass: multi-line console statements
    const lines = content.split('\n');
    const newLines = [];
    let inConsoleStatement = false;
    let consoleIndent = '';
    let consoleBuffer = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if line starts a console statement
      if (!inConsoleStatement && /^\s*console\.(log|error|warn|info|debug)\(/.test(line)) {
        const match = line.match(/^(\s*)/);
        consoleIndent = match ? match[1] : '';
        consoleBuffer = [line];
        inConsoleStatement = true;
        
        // Check if it's a single-line statement
        if (line.includes(');')) {
          // Count parentheses to ensure it's complete
          const openParens = (line.match(/\(/g) || []).length;
          const closeParens = (line.match(/\)/g) || []).length;
          
          if (openParens === closeParens) {
            newLines.push(`${consoleIndent}// ${line.trim()}`);
            inConsoleStatement = false;
            consoleBuffer = [];
            linesCommented++;
            modified = true;
            continue;
          }
        }
      } else if (inConsoleStatement) {
        consoleBuffer.push(line);
        
        // Check if this line closes the statement
        if (line.includes(');')) {
          // Count total parentheses in buffer
          const fullStatement = consoleBuffer.join('\n');
          const openParens = (fullStatement.match(/\(/g) || []).length;
          const closeParens = (fullStatement.match(/\)/g) || []).length;
          
          if (openParens === closeParens) {
            // Comment out all lines in the buffer
            consoleBuffer.forEach((bufferedLine, idx) => {
              if (idx === 0) {
                newLines.push(`${consoleIndent}// ${bufferedLine.trim()}`);
              } else {
                const lineIndent = bufferedLine.match(/^(\s*)/)[1];
                newLines.push(`${lineIndent}// ${bufferedLine.trim()}`);
              }
            });
            inConsoleStatement = false;
            consoleBuffer = [];
            linesCommented += consoleBuffer.length || 1;
            modified = true;
            continue;
          }
        }
      } else {
        newLines.push(line);
      }
    }

    // Handle any remaining buffer
    if (consoleBuffer.length > 0) {
      newLines.push(...consoleBuffer);
    }

    content = newLines.join('\n');

    if (modified && content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      filesProcessed++;
      console.log(`✅ Processed: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function processDirectory(dir) {
  const fullPath = path.join(process.cwd(), dir);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Directory not found: ${dir}`);
    return;
  }

  const files = fs.readdirSync(fullPath, { withFileTypes: true });

  files.forEach(file => {
    const filePath = path.join(fullPath, file.name);
    
    if (file.isDirectory()) {
      processDirectory(path.relative(process.cwd(), filePath));
    } else if (file.isFile() && (file.name.endsWith('.ts') || file.name.endsWith('.js'))) {
      commentOutConsoleLogs(filePath);
    }
  });
}

console.log('🚀 Starting to comment out console logs...\n');

directories.forEach(dir => {
  console.log(`📁 Processing directory: ${dir}`);
  processDirectory(dir);
});

console.log('\n✨ Done!');
console.log(`📊 Files processed: ${filesProcessed}`);
console.log(`💬 Console statements commented: ${linesCommented}`);
