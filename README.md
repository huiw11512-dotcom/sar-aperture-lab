# SAR Aperture Lab

可视化优先的 SAR 系统级任务仿真网页。主页为 `index.html`，不需要安装软件。

## 在线发布（GitHub Pages）

打开仓库 **Settings → Pages**，在 **Build and deployment** 中选择 **Deploy from a branch**，分支选择 **main**，目录选择 **/(root)**，点击 **Save**。首次部署完成后访问：

https://huiw11512-dotcom.github.io/sar-aperture-lab/

## 功能

- 横滨港在线 Esri 卫星底图及 OpenStreetMap 街道图；底图需要联网，无法加载时明确标识替代资料。
- 任务参数：高度、飞行速度、扫描时间、入射角、PRF、射频和信号参数；实时航迹与地面几何计算。
- 可交互三维飞行场景、射频收发框图、逐级信号观察、链路预算。
- 分布式散射场景的复数回波仿真、距离压缩、BP 和近似 RDA 图像对比。

## 使用边界

此项目是系统级仿真教学及设计原型。在线卫星底图是真实地理资料，SAR 图像是从近似散射模型产生的**仿真结果**，并非实测 SAR 影像。当前成像使用局部孔径的代表性采样点，并非把计划任务的所有 PRF 脉冲完整仿真。外部地图瓦片可用性取决于网络、提供商服务和使用许可。
