# Rest Reminder

一个跨平台的桌面休息提醒应用，帮助你在长时间工作后适当休息。

![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)
![Size](https://img.shields.io/badge/size-<10MB-green)

## 特性

- 🕐 **精准计时器** - 基于 Rust tokio 实现的精准倒计时
- ⏱️ **可配置时长** - 工作时长 1-120 分钟，休息时长 1-30 分钟
- 🔔 **屏幕弹窗提醒** - 工作完成后屏幕顶部显示美观的提醒弹窗
- 📦 **系统托盘驻留** - 应用最小化到托盘，不占用任务栏
- 💾 **配置持久化** - 自动保存你的设置，下次启动时恢复
- 🎨 **现代扁平化 UI** - 使用 Tailwind CSS 设计的渐变色界面
- 🖥️ **跨平台支持** - Windows、macOS、Linux 全平台支持
- 📦 **轻量级安装** - 安装包小于 10 MB

## 截图

### 主窗口
- 大倒计时显示
- 实时进度条
- 工作时长和休息时长滑块设置
- 提示音开关

### 提醒弹窗
- 屏幕顶部居中显示
- 始终置顶，不会被遮挡
- "开始休息" 和 "稍后提醒" 两个选项

## 安装

### 方式一：下载安装包

从 [Releases](../../releases) 页面下载对应平台的安装包：

- **Windows**: `rest-reminder_1.0.0_x64-setup.exe`
- **macOS**: `Rest Reminder_1.0.0_x64.dmg`
- **Linux**: `rest-reminder_1.0.0_amd64.deb` 或 `.AppImage`

### 方式二：从源码构建

#### 环境要求

- **Node.js** >= 18
- **Rust** >= 1.77.2 ([安装指南](https://rustup.rs/))
- **Windows** 需要 [Visual Studio Build Tools](https://aka.ms/vs/17/release/vs_BuildTools.exe)

#### 构建步骤

```bash
# 克隆仓库
git clone https://github.com/your-username/rest-reminder.git
cd rest-reminder

# 安装依赖
npm install

# 构建应用
npm run tauri build
```

构建完成后，安装包位于 `src-tauri/target/release/bundle/` 目录。

## 使用

### 启动应用

双击桌面图标或从开始菜单启动应用。

### 设置时间

1. 在主窗口中，拖动滑块调整 **工作时长**（1-120 分钟）
2. 拖动滑块调整 **休息时长**（1-30 分钟）
3. 可选：勾选 **启用提示音**
4. 设置会自动保存

### 开始计时

1. 点击 **开始** 按钮开始工作倒计时
2. 工作时间结束后，会弹出提醒窗口
3. 点击 **开始休息** 进入休息倒计时
4. 休息结束后自动开始新的工作周期

### 控制按钮

- **开始** - 启动计时器
- **暂停** - 暂停当前计时
- **重置** - 重置到初始状态

### 系统托盘

- 应用最小化到系统托盘
- 右键托盘图标可打开菜单：
  - 显示 - 打开主窗口
  - 隐藏 - 隐藏主窗口
  - 退出 - 完全退出应用

## 开发

### 环境准备

```bash
# 安装依赖
npm install
```

### 开发模式

```bash
npm run tauri dev
```

这将启动：
- Vite 开发服务器（热重载）
- Tauri 应用窗口
- 自动监听文件变化

### 项目结构

```
rest-reminder/
├── src/                    # React 前端
│   ├── components/         # UI 组件
│   │   ├── MainWindow.tsx  # 主窗口
│   │   └── ReminderWindow.tsx  # 提醒窗口
│   ├── hooks/             # 自定义 Hooks
│   │   └── useTimer.ts   # 计时器状态管理
│   ├── types/             # TypeScript 类型
│   │   └── timer.ts
│   ├── App.tsx            # 应用入口
│   ├── main.tsx           # React 挂载
│   └── index.css         # Tailwind CSS
├── src-tauri/            # Rust 后端
│   ├── src/
│   │   ├── lib.rs        # 主入口 + 托盘
│   │   ├── timer.rs      # 计时器核心
│   │   └── commands.rs   # Tauri 命令
│   └── tauri.conf.json  # 应用配置
└── dist/                 # 构建输出
```

### 技术栈

- **前端**：React 18 + TypeScript + Tailwind CSS
- **后端**：Rust + Tauri 2.x
- **构建工具**：Vite
- **跨平台**：Tauri (WebView2 on Windows, WebKit on macOS/Linux)

## 配置文件

配置保存在用户数据目录：

- **Windows**: `%APPDATA%\com.restreminder.app\`
- **macOS**: `~/Library/Application Support/com.restreminder.app/`
- **Linux**: `~/.config/com.restreminder.app/`

配置项（`config.json`）：
```json
{
  "work_duration": 25,
  "rest_duration": 5,
  "enable_sound": true
}
```

## 常见问题

### Q: 为什么安装包需要 Visual Studio Build Tools？

A: Tauri 使用 Rust 编译原生代码，在 Windows 上需要 MSVC 编译器来构建。

### Q: 计时不准确怎么办？

A: 计时器使用系统时间计算，确保电脑时间同步准确。

### Q: 如何自定义界面颜色？

A: 修改 `src/index.css` 中的 Tailwind 颜色类，然后重新构建。

### Q: 应用启动后不显示？

A: 检查系统托盘是否有应用图标，右键选择"显示"。

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 致谢

- [Tauri](https://tauri.app/) - 跨平台桌面应用框架
- [React](https://react.dev/) - 用户界面库
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
