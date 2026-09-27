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
