// advanced-debug.js - Run this to check more detailed issues
const fs = require('fs');
const path = require('path');

console.log('🔧 ADVANCED DEBUG: Checking detailed issues...\n');

// Check file contents and permissions
const indexPath = path.join(process.cwd(), 'client', 'index.html');
const serverPath = path.join(process.cwd(), 'server', 'index.js');

console.log('📄 Checking file contents and permissions:');

try {
    // Check index.html
    const indexStats = fs.statSync(indexPath);
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    console.log('✓ index.html size:', indexStats.size, 'bytes');
    console.log('✓ index.html permissions:', indexStats.mode.toString(8));
    console.log('✓ index.html first 100 chars:', indexContent.substring(0, 100));
    console.log('✓ index.html contains DOCTYPE:', indexContent.includes('<!DOCTYPE'));
    console.log('✓ index.html contains <html>:', indexContent.includes('<html'));
} catch (error) {
    console.error('❌ Error reading index.html:', error.message);
}

try {
    // Check server/index.js
    const serverStats = fs.statSync(serverPath);
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    console.log('✓ server/index.js size:', serverStats.size, 'bytes');
    console.log('✓ server/index.js permissions:', serverStats.mode.toString(8));
    console.log('✓ server/index.js contains express:', serverContent.includes('express'));
    console.log('✓ server/index.js contains app.get:', serverContent.includes('app.get'));
    console.log('✓ server/index.js contains app.listen:', serverContent.includes('app.listen'));
} catch (error) {
    console.error('❌ Error reading server/index.js:', error.message);
}

// Check for potential port conflicts
console.log('\n🔌 Checking for port conflicts:');
const net = require('net');

function checkPort(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
            server.once('close', () => resolve(true));
            server.close();
        });
        server.on('error', () => resolve(false));
    });
}

checkPort(3000).then(available => {
    console.log('✓ Port 3000 available:', available ? '✅ YES' : '❌ NO (already in use)');
    
    if (!available) {
        console.log('💡 Try killing any existing processes on port 3000:');
        console.log('   sudo lsof -t -i tcp:3000 | xargs kill -9');
        console.log('   Or change the port in server/index.js');
    }
});

// Check Node.js version
console.log('\n🟢 Environment info:');
console.log('✓ Node.js version:', process.version);
console.log('✓ Platform:', process.platform);
console.log('✓ Architecture:', process.arch);

// Test express installation
console.log('\n📦 Testing express installation:');
try {
    const express = require('express');
    console.log('✓ Express loaded successfully');
    console.log('✓ Express version:', require('express/package.json').version);
} catch (error) {
    console.error('❌ Error loading express:', error.message);
}

console.log('\n🧪 Testing basic Express server:');
try {
    const express = require('express');
    const testApp = express();
    
    testApp.get('/test', (req, res) => {
        res.send('Test route works!');
    });
    
    const testServer = testApp.listen(3001, () => {
        console.log('✅ Basic Express server test successful on port 3001');
        testServer.close();
    });
    
    testServer.on('error', (error) => {
        console.error('❌ Basic Express server test failed:', error.message);
    });
    
} catch (error) {
    console.error('❌ Express test failed:', error.message);
}

console.log('\n💡 Additional troubleshooting:');
console.log('1. Try visiting http://localhost:3000/ directly');
console.log('2. Check browser network tab for actual error codes');
console.log('3. Try curl: curl -v http://localhost:3000/');
console.log('4. Check if any firewall is blocking port 3000');
console.log('5. Try a different browser or incognito mode');