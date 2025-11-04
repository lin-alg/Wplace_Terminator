# Wplace_Versatile_Tool

(此扩展如此有用，以至于值得您独立安装它。如果您愿意贡献篡改猴版本，我将万分感谢)
(This extension is so useful that it's worth the time to install it. and I would be extremely grateful if you were willing to contribute a tamper monkey version.)

选择语言 / Choose language  
- [中文（简体）](#a-中文部分)  
- [English](#b-english-section)

---

## A. 中文部分

### 目录（点击跳转）
- [概览](#概览)
- [适合谁用](#适合谁用)
- [主要功能](#主要功能)
- [快速开始](#快速开始)
  - [安装（开发 / 调试）](#安装开发--调试)
  - [快速使用步骤](#快速使用步骤)
- [常见问题（FAQ）](#常见问题faq)
- [隐私与安全](#隐私与安全)
- [反馈与支持](#反馈与支持)
- [附录：小提示](#附录小提示)

---

### 概览
Wplace多功能工具 是一个轻量的悬浮式扩展。它可以：
- 分享坐标：一键分享基准坐标和位置信息
- 跳转：粘贴别人分享的坐标，立刻跳转到对应位置并自动向绘画插件填入基准坐标
- 收藏历史坐标
- 标尺：测量一幅画的总像素量或是长宽，不用再人工估计
- 地图样式：可以关闭地名和道路显示，使地图更清爽
- 快捷键：用键盘就可以放缩地图大小；新增可以显示/隐藏绘图插件的快捷键，绘图时更专心
- 自动检查更新功能
---

### 适合谁用
- 想快速在 wplace.live 或类似地图上定位某个瓦片的用户；  
- 与朋友协作共享地图视角时需要精确坐标的场景；  
- 不想手动寻找并输入基准坐标的用户；
- 想提高绘画生产力的用户。

---

### 快速开始

#### 安装
1. 下载最新的release到本地。（以v2.3版本为例）
![alt text](./images/image-6.png)
![alt text](./images/image-7.png)
2. 打开 Chrome或Edge 扩展管理页（chrome://extensions/ 或 edge://extensions/），打开“开发者模式”。  
- 谷歌：
![alt text](./images/image-1.png)
- Edge: 
![alt text](./images/image-8.png)
3. 点击“加载已解压的扩展”，选择本项目的 src 文件夹。 
![alt text](./images/image.png) 
4. 打开或刷新 Wplace 网站。

#### 使用步骤
1. 页面右下角会出现一个悬浮图标，单击即可打开面板。 
![alt text](./images/image-2.png) 
2. 页面上有各种功能的按钮，鼠标移动到上面即可显示对应功能。
![alt text](./images/image-3.png) 
3. W键控制绘画插件（blue marble或者是skirk marble）的显示，S键控制本插件面板的显示，A和D分别是放大和缩小。长按鼠标右键可以缩小。    
在地图视野过宽的情况下，点击地图任意位置即可自动放大到那个区域，再也不会出现“请放大以选择像素”的烦人弹窗。
![alt text](./images/image-10.png) 
---

### 隐私与安全
- 本扩展仅在本地读取/写入需要的坐标与主题设置，不会把坐标上传到外部服务器。  
- 如果关心隐私或想查看实现，请检查扩展源码

---

### 反馈与支持
欢迎在仓库提交 Issue 或 PR，描述你遇到的问题并附上控制台日志（若方便）。页面适配问题通常需要目标页面的简要说明或截图帮助定位问题。

---

### 常见问题
- 如果无法切换主题或地图样式，请把后面的参数（?_wplace_reload=……）去掉，重新进入网站即可生效。
![alt text](./images/image-11.png) 
推荐移除道路显示，地名显示根据个人喜好决定。一旦选定好地图样式和主题，最好不要频繁切换，以免切换失败。

---

## B. English section

### Contents (click to jump)
- [Overview](#overview)
- [Who it's for](#who-its-for)
- [Features](#features)
- [Quick Start](#quick-start)
  - [Installation (Dev / Debug)](#installation-dev--debug)
  - [Quick usage steps](#quick-usage-steps-1)
- [FAQ](#faq)
- [Privacy & Security](#privacy--security)
- [Feedback & Support](#feedback--support)
- [Appendix: tips](#appendix-tips)

---

### Overview
Wplace_Versatile_Tool is a light floating browser extension that helps you:
- Copy and share pixel coordinates (four-values: TlX, TlY, PxX, PxY);  
- Convert those four-values into latitude/longitude and open the location on wplace.live;  
- Auto-fill coordinate inputs on supported pages to save manual work.

---

### Who it's for
- Users who want to quickly locate tiles on wplace.live or similar map sites;  
- People who share map views with friends and need exact coordinates;  
- Anyone who wants to avoid manually finding and typing base coordinates.

---

### Features
- Floating panel: draggable, minimizable, remembers position.  
- Share & copy: one-click copy of latest four-coordinates (with fallback).  
- Jump: converts four-coordinates to precise lat/lng and opens wplace.live.  
- Auto-fill: detects and fills TlX/TlY/PxX/PxY inputs on compatible pages.  
- Theme switch: safely apply page theme where supported.

---

### Quick Start

#### Installation (Dev / Debug)
1. Open chrome://extensions/ or edge://extensions/ and enable Developer mode.  
2. Click "Load unpacked" and select the project src (or extension root).  
3. Open https://wplace.live/ to test the panel actions.

#### Quick usage steps
1. Click the floating icon to open the panel.  
2. Click "Share" to copy the latest four-coordinates.  
3. Paste a four-coordinate string (e.g. `180,137,42,699`) into the input and click "Jump" — the extension will open the map and jump to the point.
4. On the target page the extension will try to auto-fill pending coords into the painting plugin.  
5. Minimize to icon and click again to restore.

---

### Privacy & Security
- The extension reads/writes only required coordinates and theme locally. It does not upload any information.  
- Review the source or uninstall if you have concerns.

---

### Feedback & Support
Open an Issue or PR with page details and console logs to help reproduction and fixes.

---

### Appendix: tips
- If theme changes do not persist, check DevTools to confirm the injector script loaded early.  
- If auto-fill fails, refresh the target page or wait for it to finish loading before retrying.  
- For debugging, use the browser console to inspect extension logs.

---
