# SAR Aperture Lab

真实地图场景 + SAR 系统级仿真工作台。网页版入口是仓库根目录的 `index.html`。

## GitHub Pages 部署

此仓库已配置 `.github/workflows/deploy.yml`：推送至 `main` 时自动使用 GitHub Actions 发布。请在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**（无需选择 Branch 或 Folder）。首次构建状态请查看 [Actions](https://github.com/huiw11512-dotcom/sar-aperture-lab/actions)，完成后网站地址为：

https://huiw11512-dotcom.github.io/sar-aperture-lab/

如果工作流失败，请查看具体报错，不要把仓库设置误改为 Deploy from a branch。

## 当前功能

横滨港在线卫星底图、任务几何与航迹、扫描高度/时间/速度/PRF 参数、三维场景、射频收发架构、节点波形、链路预算、距离压缩和 BP/近似 RDA 成像。

## 模型说明

这是系统级仿真原型。在线卫星底图是真实地理资料，SAR 图像为从简化散射模型生成的模拟结果，并不是同一位置的实测 SAR 影像。成像引擎采用部分代表性孔径采样点，不等于完整任务计划的全部脉冲回波数据。外部底图服务需要联网与符合数据许可。

## 扫描模式（V4）

- 多航线条带拼接：默认三条蛇形航线、逐条覆盖、单独计算转弯无采集时间。
- 单航线 Stripmap：固定侧视方向，连续形成一条地面成像带。
- 聚束 Spotlight：波束保持指向同一地面区域，展示较长驻留时间和孔径趋势。
- ScanSAR：三个距离向子条带按设定突发周期切换，展示宽幅与驻留时间之间的权衡。
- 锥扫原理：波束绕中心转动，仅作为天线扫描原理演示；它不是独立标准 SAR 成像模式。

网页叠加显示地图覆盖进度、可交互三维照射几何、理论点目标方位响应（PSF）和规划性能比较。**注意：这些是工作模式的几何与理论趋势演示，右侧公里级宽幅图仍是光学代理散射概览，局部 106m BP 仍采用原有标准条带基线；尚未为 Spotlight、ScanSAR 等模式逐个实现独立的完整原始 IQ 成像链路。**

自动化浏览器冒烟测试：`.github/workflows/scan-tests.yml`（WebGL/模式切换/多航线/覆盖图/脚本错误检查）。
