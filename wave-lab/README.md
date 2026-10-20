# Wave Lab · 波场实验室

在线入口：https://huiw11512-dotcom.github.io/sar-aperture-lab/wave-lab/

## 2026-10 界面与模型修订

- 浅色科研工作台；正文与网页科研图保持白底、清晰坐标轴与统一色阶。
- 工作频率：GHz；截面高度、长和宽：m；每个节点地面位置 (x,y)：m。
- 口径尺寸：a/λ、b/λ；显示对应米制物理尺寸；口面效率为单独参数。
- **仅一种**方向图：理想均匀照明矩形口径，复场方向图 `sinc(π a u/λ) sinc(π b v/λ)`。
- 球面传播相位 `k r` + 自定义源相位；不使用整个分布式阵列的平面波近似。
- 瞬时有符号电场、瞬时 E²、整周期平均 E²（均为归一化标量场）；点击场图查看定点周期波形。
- 网格可选 256–640；粗采样时警告可能丢失干涉条纹。
- 导出论文风格组合 PNG（3240px 宽，另以 1000×1000 网格重新计算），以及每个网格点的 CSV 数据。

## 物理假设

1. 每个口径使用远场矩形孔径方向图。**虽然整体分布式阵列可处于近场，各单元口径仍需符合自身的远场条件**。
2. 波源从地面 `z=0` 传播到水平截面 `z=H`，口径法线固定 +z；节点坐标为手动输入的地面位置。
3. 相量按 `sqrt(η) × w_n × sinc(π a u_n/λ) × sinc(π b v_n/λ) × H/r_n × exp(j(k r_n + φ_n))/N` 叠加。
4. 归一化参考为 `N` 路单位轴向场；`<E²> = |Ẽ|²/2`。所有结果均为无量纲相对场，不是绝对功率密度。
5. 不包括矢量极化、单口径近场积分、互耦、环境反射、真实目标散射、非合作目标闭环控制或高功率系统预算。

## 部署

网站由父仓库 `.github/workflows/deploy.yml` 自动发布。请于 GitHub → Settings → Pages 中使用 **GitHub Actions** 部署源；父仓库的 SAR 系统页面不受影响。

## 参考设计规范

- Anthropic's frontend-design skill: https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md
- K-Dense scientific-visualization: https://github.com/K-Dense-AI/scientific-agent-skills/blob/main/skills/scientific-visualization/SKILL.md
