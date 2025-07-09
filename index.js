const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const wiegine = require("ws3-fca");
const fs = require("fs");
const crypto = require("crypto");
const autoReact = require("./handle/autoReact");
const unsendReact = require("./handle/unsendReact");
const chalk = require("chalk");
const userManager = require("./utils/userManager");
// เพิ่มระบบทำความสะอาดแอดมิน
const { startAutoCleanup } = require("./utils/adminCleanup");

// --- ฟังก์ชันสำหรับจัดการสถานะบอท ---
const BOT_STATE_FILE_PATH = path.join(__dirname, "bot_state.json");
const ADMIN_FILE_PATH = path.join(__dirname, "admin_list.json");
const SUPER_ADMIN_ID = '61555184860915';

function loadBotState() {
  try {
    if (fs.existsSync(BOT_STATE_FILE_PATH)) {
      const data = fs.readFileSync(BOT_STATE_FILE_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading bot state:', error);
  }
  return { 
    globalEnabled: true,
    threads: {}
  };
}

function isBotEnabledInThread(threadID) {
  const botState = loadBotState();
  
  // ถ้าปิดทั่วไป ให้ปิดทุกกลุ่ม
  if (!botState.globalEnabled) {
    return false;
  }
  
  // ตรวจสอบสถานะเฉพาะกลุ่ม
  if (botState.threads[threadID] && botState.threads[threadID].hasOwnProperty('enabled')) {
    return botState.threads[threadID].enabled;
  }
  
  // ค่าเริ่มต้น: เปิดใช้งาน
  return true;
}

function loadAdmins() {
  try {
    if (fs.existsSync(ADMIN_FILE_PATH)) {
      const data = fs.readFileSync(ADMIN_FILE_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading admin list:', error);
  }
  return [];
}

function isAdmin(userID) {
  const admins = loadAdmins();
  return userID === SUPER_ADMIN_ID || admins.includes(userID);
}

const app = express();
const PORT = process.env.PORT || 3000;
const configPath = path.join(__dirname, "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

app.use(bodyParser.json());
app.use(express.static("public"));

// API endpoints for configuration
app.get('/api/config', (req, res) => {
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      res.json({ prefix: config.prefix, adminUID: config.adminUID });
    } else {
      res.json({ prefix: "/", adminUID: "" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/config', (req, res) => {
  try {
    const { prefix, adminUID, appstate } = req.body;
    
    // บันทึก config.json
    const newConfig = {
      prefix: prefix || "/",
      adminUID,
      version: "2.4.0",
      credit: "Joshua Apostol",
      github: "https://github.com/joshuaAposto/NASH-Fb-BOT-V2"
    };
    
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
    
    // บันทึก appstate.json
    const appStatePath = path.join(__dirname, "appstate.json");
    fs.writeFileSync(appStatePath, JSON.stringify(appstate, null, 2));
    
    res.json({ success: true, message: "Configuration saved successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/status', (req, res) => {
  try {
    res.json({ 
      isLoggedIn: isLoggedIn,
      loginAttempts: loginAttempts,
      maxRetries: nax_retries
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Command management endpoints
app.get('/api/commands', (req, res) => {
  try {
    const commandsPath = path.join(__dirname, "modules", "commands");
    const files = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));
    
    const commands = files.map(file => {
      try {
        const filePath = path.join(commandsPath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const module = require(filePath);
        
        return {
          filename: file,
          name: module.name || file.replace('.js', ''),
          description: module.description || 'No description',
          nashPrefix: module.nashPrefix || false,
          role: module.role || 'user',
          aliases: module.aliases || [],
          content: content
        };
      } catch (error) {
        return {
          filename: file,
          name: file.replace('.js', ''),
          description: 'Error loading command',
          error: error.message
        };
      }
    });

    res.json({ success: true, commands });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/commands', (req, res) => {
  try {
    const { filename, content } = req.body;
    
    if (!filename || !content) {
      return res.status(400).json({ success: false, message: 'filename และ content จำเป็นต้องกรอก' });
    }

    const commandsPath = path.join(__dirname, "modules", "commands");
    const filePath = path.join(commandsPath, filename.endsWith('.js') ? filename : filename + '.js');
    
    // ตรวจสอบว่าเป็น JavaScript ที่ถูกต้อง
    try {
      new Function(content);
    } catch (syntaxError) {
      return res.status(400).json({ success: false, message: 'Syntax Error: ' + syntaxError.message });
    }

    fs.writeFileSync(filePath, content);
    
    // ลบ cache เพื่อให้โหลดใหม่
    delete require.cache[require.resolve(filePath)];
    
    // โหลดคำสั่งใหม่
    try {
      const module = require(filePath);
      if (module && module.name && module.execute) {
        global.NashBoT.commands.set(module.name, module);
        
        if (module.aliases && Array.isArray(module.aliases)) {
          module.aliases.forEach(alias => {
            global.NashBoT.commands.set(alias, module);
          });
        }
        
        // รีโหลดคำสั่งที่สร้างขึ้นใหม่ทั้งหมด
        if (global.NashBoT.reloadGeneratedCommands) {
          global.NashBoT.reloadGeneratedCommands();
        }
      }
    } catch (loadError) {
      return res.status(400).json({ success: false, message: 'Load Error: ' + loadError.message });
    }

    res.json({ success: true, message: 'บันทึกคำสั่งเรียบร้อยแล้ว' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/commands/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const commandsPath = path.join(__dirname, "modules", "commands");
    const filePath = path.join(commandsPath, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'ไม่พบไฟล์คำสั่ง' });
    }

    // ลบ cache
    delete require.cache[require.resolve(filePath)];
    
    // ลบจาก commands map
    try {
      const module = require(filePath);
      if (module.name) {
        global.NashBoT.commands.delete(module.name);
        
        if (module.aliases && Array.isArray(module.aliases)) {
          module.aliases.forEach(alias => {
            global.NashBoT.commands.delete(alias);
          });
        }
      }
    } catch (error) {
      // ไม่สำคัญถ้าโหลดไม่ได้
    }
    
    // ลบไฟล์
    fs.unlinkSync(filePath);
    
    res.json({ success: true, message: 'ลบคำสั่งเรียบร้อยแล้ว' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/start', (req, res) => {
  try {
    if (!isLoggedIn) {
      relogin();
      res.json({ success: true, message: "Bot starting..." });
    } else {
      res.json({ success: true, message: "Bot is already running" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// User Authentication API Endpoints
app.post('/api/auth/register', async (req, res) => {
  try {
    const { userId, password } = req.body;
    
    if (!userId || !password) {
      return res.status(400).json({ success: false, message: 'กรุณากรอก User ID และรหัสผ่าน' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
    }
    
    const result = await userManager.registerUser(userId, password);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { userId, password } = req.body;
    
    if (!userId || !password) {
      return res.status(400).json({ success: false, message: 'กรุณากรอก User ID และรหัสผ่าน' });
    }
    
    const result = await userManager.loginUser(userId, password);
    
    if (result.success) {
      // เก็บ session ใน cookie
      res.cookie('userSession', userId, { 
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true 
      });
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const userId = req.cookies.userSession;
    
    if (userId) {
      const result = await userManager.logoutUser(userId);
      res.clearCookie('userSession');
      res.json(result);
    } else {
      res.json({ success: true, message: 'ไม่มี session ที่ต้องออกจากระบบ' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/auth/status', async (req, res) => {
  try {
    const userId = req.cookies.userSession;
    
    if (!userId) {
      return res.json({ isLoggedIn: false });
    }
    
    const isLoggedIn = await userManager.isUserLoggedIn(userId);
    
    if (isLoggedIn) {
      res.json({ isLoggedIn: true, userId });
    } else {
      res.clearCookie('userSession');
      res.json({ isLoggedIn: false });
    }
  } catch (error) {
    res.json({ isLoggedIn: false });
  }
});

// Admin endpoints for user management
app.get('/api/admin/users', async (req, res) => {
  try {
    // ตรวจสอบว่าเป็น admin หรือไม่
    const userId = req.cookies.userSession;
    const botConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    
    if (userId !== botConfig.adminUID) {
      return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง' });
    }
    
    const users = await userManager.getAllUsers();
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/users/:userId/toggle', async (req, res) => {
  try {
    const adminId = req.cookies.userSession;
    const botConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    
    if (adminId !== botConfig.adminUID) {
      return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง' });
    }
    
    const { userId } = req.params;
    const { isActive } = req.body;
    
    const result = await userManager.toggleUserStatus(userId, isActive);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/admin/users/:userId', async (req, res) => {
  try {
    const adminId = req.cookies.userSession;
    const botConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    
    if (adminId !== botConfig.adminUID) {
      return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง' });
    }
    
    const { userId } = req.params;
    const result = await userManager.deleteUser(userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// User management file path
const usersFilePath = path.join(__dirname, "users.json");

// Load users from file
function loadUsers() {
  try {
    if (fs.existsSync(usersFilePath)) {
      return JSON.parse(fs.readFileSync(usersFilePath, "utf8"));
    }
  } catch (error) {
    console.error('Error loading users:', error);
  }
  return {};
}

// Save users to file
function saveUsers(users) {
  try {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error saving users:', error);
  }
}

// Hash password
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Generate token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// User registration endpoint
app.post('/api/register', (req, res) => {
  try {
    const { userid, password } = req.body;
    
    if (!userid || !password) {
      return res.status(400).json({ success: false, message: 'กรุณากรอก User ID และรหัสผ่าน' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
    }
    
    const users = loadUsers();
    
    if (users[userid]) {
      return res.status(400).json({ success: false, message: 'User ID นี้ได้ลงทะเบียนแล้ว' });
    }
    
    users[userid] = {
      password: hashPassword(password),
      registeredAt: new Date().toISOString(),
      lastLogin: null,
      isActive: true
    };
    
    saveUsers(users);
    
    res.json({ success: true, message: 'ลงทะเบียนสำเร็จ' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// User login endpoint
app.post('/api/login', (req, res) => {
  try {
    const { userid, password } = req.body;
    
    if (!userid || !password) {
      return res.status(400).json({ success: false, message: 'กรุณากรอก User ID และรหัสผ่าน' });
    }
    
    const users = loadUsers();
    const user = users[userid];
    
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User ID หรือรหัสผ่านไม่ถูกต้อง' });
    }
    
    if (user.password !== hashPassword(password)) {
      return res.status(401).json({ success: false, message: 'User ID หรือรหัสผ่านไม่ถูกต้อง' });
    }
    
    // Update last login
    user.lastLogin = new Date().toISOString();
    saveUsers(users);
    
    // Generate token
    const token = generateToken();
    
    // Store token (in real app, use Redis or database)
    if (!global.userTokens) global.userTokens = {};
    global.userTokens[token] = userid;
    
    res.json({ 
      success: true, 
      message: 'เข้าสู่ระบบสำเร็จ',
      token: token
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Token verification endpoint
app.post('/api/verify-token', (req, res) => {
  try {
    const { token, userid } = req.body;
    
    if (!token || !userid) {
      return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
    }
    
    if (!global.userTokens || global.userTokens[token] !== userid) {
      return res.status(401).json({ success: false, message: 'Token ไม่ถูกต้อง' });
    }
    
    const users = loadUsers();
    const user = users[userid];
    
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'ผู้ใช้ไม่ถูกต้อง' });
    }
    
    res.json({ success: true, message: 'Token ถูกต้อง' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

global.NashBoT = {
  commands: new Map(),
  events: new Map(),
  onlineUsers: new Map(),
  cooldowns: new Map(),
  reloadGeneratedCommands: () => reloadGeneratedCommands()
};

global.NashBot = {
  JOSHUA: "https://kaiz-apis.gleeze.com/"
};

let isLoggedIn = false;
let loginAttempts = 0;
const nax_retries = 5;
const interval = 5000;

const loadModules = (type) => {
  const folderPath = path.join(__dirname, "modules", type);
  const files = fs.readdirSync(folderPath).filter(file => file.endsWith(".js"));

  console.log(chalk.bold.redBright(`──LOADING ${type.toUpperCase()}──●`));
  
    files.forEach(file => {
    const module = require(path.join(folderPath, file));
    if (module && module.name && module[type === "commands" ? "execute" : "onEvent"]) {
      module.nashPrefix = module.nashPrefix !== undefined ? module.nashPrefix : true;
      module.cooldowns = module.cooldowns || 0;
      
      // เก็บคำสั่งด้วยตัวพิมพ์เล็กสำหรับ commands
      if (type === "commands") {
        global.NashBoT[type].set(module.name.toLowerCase(), module);
        
        if (module.aliases && Array.isArray(module.aliases)) {
          module.aliases.forEach(alias => {
            global.NashBoT[type].set(alias.toLowerCase(), module);
          });
        }
      } else {
        global.NashBoT[type].set(module.name, module);
      }
      
      console.log(
        chalk.bold.gray("[") + 
        chalk.bold.cyan("INFO") + 
        chalk.bold.gray("] ") + 
        chalk.bold.green(`Loaded ${type.slice(0, -1)}: `) + 
        chalk.bold.magenta(module.name)
      );
    }
  });

  // โหลดคำสั่งจากโฟลเดอร์ generated_commands ด้วย
  if (type === "commands") {
    const generatedPath = path.join(folderPath, "generated_commands");
    if (fs.existsSync(generatedPath)) {
      const generatedFiles = fs.readdirSync(generatedPath).filter(file => file.endsWith(".js"));
      
      generatedFiles.forEach(file => {
        try {
          const filePath = path.join(generatedPath, file);
          delete require.cache[require.resolve(filePath)];
          const module = require(filePath);
          
          if (module && module.name && module.execute) {
            module.nashPrefix = module.nashPrefix !== undefined ? module.nashPrefix : true;
            module.cooldowns = module.cooldowns || 0;
            
            // ตรวจสอบว่าคำสั่งซ้ำหรือไม่
            if (global.NashBoT.commands.has(module.name.toLowerCase())) {
              console.log(
                chalk.bold.gray("[") + 
                chalk.bold.yellow("WARN") + 
                chalk.bold.gray("] ") + 
                chalk.bold.yellow(`Command name conflict: ${module.name} (overwriting)`)
              );
            }
            
            // เก็บคำสั่งด้วยตัวพิมพ์เล็ก
            global.NashBoT.commands.set(module.name.toLowerCase(), module);
            
            if (module.aliases && Array.isArray(module.aliases)) {
              module.aliases.forEach(alias => {
                if (global.NashBoT.commands.has(alias.toLowerCase())) {
                  console.log(
                    chalk.bold.gray("[") + 
                    chalk.bold.yellow("WARN") + 
                    chalk.bold.gray("] ") + 
                    chalk.bold.yellow(`Alias conflict: ${alias} (overwriting)`)
                  );
                }
                global.NashBoT.commands.set(alias.toLowerCase(), module);
              });
            }
            
            console.log(
              chalk.bold.gray("[") + 
              chalk.bold.cyan("INFO") + 
              chalk.bold.gray("] ") + 
              chalk.bold.green("Loaded generated command: ") + 
              chalk.bold.magenta(module.name) +
              (module.aliases ? chalk.bold.gray(` [${module.aliases.join(', ')}]`) : "")
            );
          }
        } catch (error) {
          console.error(
            chalk.bold.gray("[") + 
            chalk.bold.red("ERROR") + 
            chalk.bold.gray("] ") + 
            chalk.bold.redBright(`Failed to load generated command ${file}: ${error.message}`)
          );
        }
      });
    }
  }
};

const relogin = async () => {
  if (isLoggedIn) return;

  const appStatePath = path.join(__dirname, "appstate.json");
  if (fs.existsSync(appStatePath)) {
    try {
      const appState = JSON.parse(fs.readFileSync(appStatePath, "utf8"));
      
      // Add timeout to prevent hanging
      const loginTimeout = setTimeout(() => {
        console.error(
          chalk.bold.gray("[") + 
          chalk.bold.red("TIMEOUT") + 
          chalk.bold.gray("] ") + 
          chalk.bold.redBright("Login timeout - retrying...")
        );
        
        // ลบ appstate.json หลังจาก timeout
        setTimeout(() => {
          const appStatePath = path.join(__dirname, "appstate.json");
          if (fs.existsSync(appStatePath)) {
            try {
              fs.unlinkSync(appStatePath);
              console.log(
                chalk.bold.gray("[") + 
                chalk.bold.yellow("CLEANUP") + 
                chalk.bold.gray("] ") + 
                chalk.bold.yellowBright("Token deleted due to timeout. Please configure new token via web interface.")
              );
            } catch (error) {
              console.error(
                chalk.bold.gray("[") + 
                chalk.bold.red("ERROR") + 
                chalk.bold.gray("] ") + 
                chalk.bold.redBright("Failed to delete token:", error.message)
              );
            }
          }
        }, 60000); // 60 วินาที
        
        retryLogin();
      }, 30000); // 30 second timeout

      wiegine.login(appState, {}, (err, api) => {
        clearTimeout(loginTimeout);
        
        if (err) {
          console.error(
            chalk.bold.gray("[") + 
            chalk.bold.red("ERROR") + 
            chalk.bold.gray("] ") + 
            chalk.bold.redBright("Failed to auto-login:", err.message)
          );
          retryLogin();
          return;
        }
        const cuid = api.getCurrentUserID();
        global.NashBoT.onlineUsers.set(cuid, { userID: cuid, prefix: config.prefix });
        setupBot(api, config.prefix);
        isLoggedIn = true;
        loginAttempts = 0;
      });
    } catch (error) {
      console.error(
        chalk.bold.gray("[") + 
        chalk.bold.red("ERROR") + 
        chalk.bold.gray("] ") + 
        chalk.bold.redBright("Invalid appstate.json:", error.message)
      );
      retryLogin();
    }
  } else {
    console.error(
      chalk.bold.gray("[") + 
      chalk.bold.red("ERROR") + 
      chalk.bold.gray("] ") + 
      chalk.bold.redBright("appstate.json not found")
    );
  }
};

const retryLogin = () => {
  if (loginAttempts >= nax_retries) {
    console.error(
      chalk.bold.gray("[") + 
      chalk.bold.red("ERROR") + 
      chalk.bold.gray("] ") + 
      chalk.bold.redBright("Max login attempts reached. Please check your appstate file.")
    );
    
    // ลบ appstate.json หลังจาก 60 วินาที
    setTimeout(() => {
      const appStatePath = path.join(__dirname, "appstate.json");
      if (fs.existsSync(appStatePath)) {
        try {
          fs.unlinkSync(appStatePath);
          console.log(
            chalk.bold.gray("[") + 
            chalk.bold.yellow("CLEANUP") + 
            chalk.bold.gray("] ") + 
            chalk.bold.yellowBright("Token deleted due to login failure. Please configure new token via web interface.")
          );
        } catch (error) {
          console.error(
            chalk.bold.gray("[") + 
            chalk.bold.red("ERROR") + 
            chalk.bold.gray("] ") + 
            chalk.bold.redBright("Failed to delete token:", error.message)
          );
        }
      }
    }, 60000); // 60 วินาที
    
    return;
  }

  loginAttempts++;
  console.log(
    chalk.bold.gray("[") + 
    chalk.bold.yellow("RETRY") + 
    chalk.bold.gray("] ") + 
    chalk.bold.yellowBright(`Retrying login attempt ${loginAttempts} of ${nax_retries}...`)
  );

  setTimeout(relogin, interval);
};

const setupBot = (api, prefix) => {
  api.setOptions({
    forceLogin: false,
    selfListen: false,
    autoReconnect: false,
    listenEvents: true,
    logLevel: "silent",
    updatePresence: false,
    online: false,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });

  api.listenMqtt((err, event) => {
    if (err) {
      console.error(
        chalk.bold.gray("[") + 
        chalk.bold.red("ERROR") + 
        chalk.bold.gray("] ") + 
        chalk.bold.redBright("Connection error detected, attempting relogin...")
      );
      isLoggedIn = false;
      retryLogin();
      return;
    }

    try {
      handleMessage(api, event, prefix);
      handleEvent(api, event, prefix);
      autoReact(api, event);
      unsendReact(api, event);
    } catch (error) {
      console.error(
        chalk.bold.gray("[") + 
        chalk.bold.red("ERROR") + 
        chalk.bold.gray("] ") + 
        chalk.bold.redBright("Error in event handler:", error.message)
      );
      
      // ป้องกัน Maximum call stack exceeded
      if (error.message && error.message.includes('Maximum call stack size exceeded')) {
        console.error(
          chalk.bold.gray("[") + 
          chalk.bold.red("CRITICAL") + 
          chalk.bold.gray("] ") + 
          chalk.bold.redBright("Stack overflow detected - restarting process...")
        );
        process.exit(1);
      }
    }
  });
  
  setInterval(() => {
    api.getFriendsList(() => console.log(
      chalk.bold.gray("[") + 
      chalk.bold.cyan("INFO") + 
      chalk.bold.gray("] ") + 
      chalk.bold.green("Keep-alive signal sent")
    ));
  }, 1000 * 60 * 45);
};

const handleEvent = async (api, event, prefix) => {
  const { events } = global.NashBoT;
  
  // ตรวจสอบสถานะของบอทในกลุ่มนี้ สำหรับ events
  const userIsAdmin = isAdmin(event.senderID);
  const botEnabledInThread = isBotEnabledInThread(event.threadID);
  
  // ถ้าบอทถูกปิดในกลุ่มนี้และผู้ใช้ไม่ใช่แอดมิน ให้ไม่ประมวลผล events ทั่วไป
  if (!botEnabledInThread && !userIsAdmin) {
    return; // ไม่ทำงาน events เมื่อบอทปิดในกลุ่มนี้ (ยกเว้นแอดมิน)
  }
  
  try {
    for (const { onEvent } of events.values()) {
      await onEvent({ prefix, api, event });
    }
  } catch (err) {
    console.error(
      chalk.bold.gray("[") + 
      chalk.bold.red("ERROR") + 
      chalk.bold.gray("] ") + 
      chalk.bold.redBright("Event handler error:")
    );
  }
};

const handleMessage = async (api, event, prefix) => {
  if (!event.body) return;

  // ตรวจสอบสถานะของบอทในกลุ่มนี้
  const userIsAdmin = isAdmin(event.senderID);
  const botEnabledInThread = isBotEnabledInThread(event.threadID);
  
  // ถ้าบอทถูกปิดในกลุ่มนี้และผู้ใช้ไม่ใช่แอดมิน ให้ไม่ตอบสนอง
  if (!botEnabledInThread && !userIsAdmin) {
    return; // ไม่ทำอะไรเลย (ไม่ตอบกลับ)
  }

  // เช็กคำหยาบก่อนประมวลผลคำสั่ง
  try {
    const badwordCmd = global.NashBoT.commands.get('เช็กคำหยาบ');
    if (badwordCmd && badwordCmd.checkMessage) {
      await badwordCmd.checkMessage(api, event);
    }
  } catch (err) {
    console.error('Badword check error:', err);
  }

  await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));

  let [command, ...args] = event.body.trim().split(" ");
  if (command.startsWith(prefix)) command = command.slice(prefix.length);

  // Debug log สำหรับการค้นหาคำสั่ง
  const commandLower = command.toLowerCase();
  const cmdFile = global.NashBoT.commands.get(commandLower);
  
  if (cmdFile) {
    console.log(
      chalk.bold.gray("[") + 
      chalk.bold.blue("CMD") + 
      chalk.bold.gray("] ") + 
      chalk.bold.white(`Command found: "${commandLower}" -> "${cmdFile.name}" by ${event.senderID}`)
    );
    
    const nashPrefix = cmdFile.nashPrefix !== false;
    if (nashPrefix && !event.body.toLowerCase().startsWith(prefix)) {
      console.log(
        chalk.bold.gray("[") + 
        chalk.bold.yellow("PREFIX") + 
        chalk.bold.gray("] ") + 
        chalk.bold.yellow(`Command requires prefix "${prefix}" but not provided`)
      );
      return;
    }

    const userId = event.senderID;
    
    // เช็กการเป็นสมาชิกก่อนใช้คำสั่ง
    const { checkPermissionBeforeCommand } = require('./utils/memberUtils');
    const hasPermission = await checkPermissionBeforeCommand(api, event, cmdFile.name);
    if (!hasPermission) {
      return; // ฟังก์ชัน checkPermissionBeforeCommand จะส่งข้อความแจ้งเตือนเอง
    }
    
    // ตรวจสอบสถานะบอทอีกครั้งสำหรับคำสั่งเฉพาะ (ยกเว้นคำสั่งปิดเปิด)
    if (!botEnabledInThread && !userIsAdmin && !["ปิดเปิด", "ปิด", "เปิด", "สถานะบอท", "สถานะ", "status", "on", "off"].includes(cmdFile.name)) {
      return; // ไม่ทำอะไรถ้าบอทปิดในกลุ่มนี้และไม่ใช่แอดมิน
    }
    
    // ตรวจสอบสิทธิ์ admin
    if (cmdFile.role === "admin" && userId !== config.adminUID) {
      return setTimeout(() => {
        api.sendMessage("คุณไม่มีสิทธิ์ใช้คำสั่งนี้", event.threadID);
      }, Math.random() * 1000 + 500);
    }

    const cooldownTime = (cmdFile.cooldowns || 0) * 1000;
    if (cooldownTime > 0) {
      if (!global.NashBoT.cooldowns.has(cmdFile.name)) {
        global.NashBoT.cooldowns.set(cmdFile.name, new Map());
      }

      const timestamps = global.NashBoT.cooldowns.get(cmdFile.name);
      const now = Date.now();
      const expirationTime = timestamps.get(userId);

      if (expirationTime && now < expirationTime) {
        const timeLeft = Math.ceil((expirationTime - now) / 1000);
        api.sendMessage(`⏰ กรุณารอ ${timeLeft} วินาที ก่อนใช้คำสั่งนี้อีกครั้ง`, event.threadID);
        return;
      }

      timestamps.set(userId, now + cooldownTime);
      setTimeout(() => timestamps.delete(userId), cooldownTime);
    }

    try {
      console.log(
        chalk.bold.gray("[") + 
        chalk.bold.green("EXEC") + 
        chalk.bold.gray("] ") + 
        chalk.bold.green(`Executing "${cmdFile.name}" for user ${userId}`)
      );
      await cmdFile.execute(api, event, args, prefix);
    } catch (err) {
      console.error(
        chalk.bold.gray("[") + 
        chalk.bold.red("CMD_ERROR") + 
        chalk.bold.gray("] ") + 
        chalk.bold.redBright(`Command "${cmdFile.name}" failed: ${err.message}`)
      );
      setTimeout(() => {
        api.sendMessage(`Command error: ${err.message}`, event.threadID);
      }, Math.random() * 1000 + 500);
    }
  } else if (command.length > 0 && event.body.startsWith(prefix)) {
    // แสดงคำสั่งที่ไม่พบ
    console.log(
      chalk.bold.gray("[") + 
      chalk.bold.red("NOT_FOUND") + 
      chalk.bold.gray("] ") + 
      chalk.bold.red(`Command not found: "${commandLower}"`)
    );
  }
};

const init = async () => {
  await loadModules("commands");
  await loadModules("events");
  
  // ตรวจสอบว่ามีการตั้งค่าแล้วหรือไม่
  const appStatePath = path.join(__dirname, "appstate.json");
  if (fs.existsSync(appStatePath) && fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (config.adminUID) {
      await relogin();
      console.log(chalk.bold.blueBright("──BOT START──●"));
      console.log(chalk.bold.red(`
 █▄░█ ▄▀█ █▀ █░█
 █░▀█ █▀█ ▄█ █▀█`));
      console.log(chalk.bold.yellow("Credits: Joshua Apostol"));
      return;
    }
  }
  
  console.log(chalk.bold.yellowBright("──CONFIGURATION REQUIRED──●"));
  console.log(chalk.bold.cyan("Please visit the web interface to configure your bot"));
  console.log(chalk.bold.green(`Web interface: http://0.0.0.0:${PORT}`));
};

init().then(() => {
  // เริ่มต้นระบบทำความสะอาดแอดมินอัตโนมัติ
  startAutoCleanup();
  
  app.listen(PORT, '0.0.0.0', () => console.log(
    chalk.bold.gray("[") + 
    chalk.bold.green("SERVER") + 
    chalk.bold.gray("] ") + 
    chalk.bold.greenBright(`Running on http://0.0.0.0:${PORT}`)
  ));
});

// ฟังก์ชันรีโหลดคำสั่งที่สร้างใหม่
const reloadGeneratedCommands = () => {
  try {
    const generatedPath = path.join(__dirname, "modules", "commands", "generated_commands");
    if (!fs.existsSync(generatedPath)) {
      console.log("Generated commands folder not found");
      return;
    }

    const generatedFiles = fs.readdirSync(generatedPath).filter(file => file.endsWith(".js"));
    let reloadedCount = 0;
    
    console.log(chalk.bold.cyan("🔄 Reloading generated commands..."));
    
    generatedFiles.forEach(file => {
      try {
        const filePath = path.join(generatedPath, file);
        
        // ลบ cache เก่า
        delete require.cache[require.resolve(filePath)];
        
        // โหลด module ใหม่
        const module = require(filePath);
        
        if (module && module.name && module.execute) {
          module.nashPrefix = module.nashPrefix !== undefined ? module.nashPrefix : true;
          module.cooldowns = module.cooldowns || 0;
          
          // ลบคำสั่งเก่าออกก่อน (ทั้งชื่อหลักและ aliases)
          if (global.NashBoT.commands.has(module.name.toLowerCase())) {
            const oldModule = global.NashBoT.commands.get(module.name.toLowerCase());
            global.NashBoT.commands.delete(module.name.toLowerCase());
            
            // ลบ aliases เก่าด้วย
            if (oldModule.aliases && Array.isArray(oldModule.aliases)) {
              oldModule.aliases.forEach(alias => {
                global.NashBoT.commands.delete(alias.toLowerCase());
              });
            }
          }
          
          // เพิ่มคำสั่งใหม่ (ใช้ตัวพิมพ์เล็ก)
          global.NashBoT.commands.set(module.name.toLowerCase(), module);
          
          // เพิ่ม aliases ใหม่ (ใช้ตัวพิมพ์เล็ก)
          if (module.aliases && Array.isArray(module.aliases)) {
            module.aliases.forEach(alias => {
              global.NashBoT.commands.set(alias.toLowerCase(), module);
            });
          }
          
          reloadedCount++;
          console.log(
            chalk.bold.gray("[") + 
            chalk.bold.green("RELOAD") + 
            chalk.bold.gray("] ") + 
            chalk.bold.magenta(`Generated command: ${module.name}`)
          );
        }
      } catch (error) {
        console.error(
          chalk.bold.gray("[") + 
          chalk.bold.red("ERROR") + 
          chalk.bold.gray("] ") + 
          chalk.bold.redBright(`Failed to reload ${file}: ${error.message}`)
        );
      }
    });
    
    console.log(chalk.bold.green(`✅ Reloaded ${reloadedCount} generated commands`));
    return reloadedCount;
  } catch (error) {
    console.error("Error in reloadGeneratedCommands:", error);
    return 0;
  }
};

// เพิ่มฟังก์ชันเป็น global
global.reloadGeneratedCommands = reloadGeneratedCommands;

// เริ่มต้นระบบทำความสะอาดแอดมินอัตโนมัติ
startAutoCleanup();
