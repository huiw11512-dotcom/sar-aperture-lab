# Wave Lab · 波场实验室

**在线入口**：https://huiw11512-dotcom.github.io/sar-aperture-lab/wave-lab/

独立的浏览器端多源波场干涉演示，主仓库 SAR Aperture Lab 不受影响。

功能：截面高度与范围、节点数、独立初始相位、相对电场幅度、独立3 dB 全波束宽度；全向/余弦幂/高斯方向图；球面传播相位；载波单周期瞬时场、瞬时平方、周期平均图；点击观察点查看时域曲线；PNG、CSV 导出。

物理模型：单频、标量、固定竖直指向 +z；距离项 1/r，功率方向图 F(θ) 用 √F(θ) 乘在场相量上。数值全部无量纲归一化。未引入实际绝对发射功率、极化、有限口径近场、真实旁瓣、散射或高功率系统控制。用于物理可视化，不可作为绝对功率密度预测工具。

部署由主仓库 `.github/workflows/deploy.yml` 负责。若首次无法访问，请在 Settings → Pages → Build and deployment → Source 选择 GitHub Actions，再查看 Actions 工作流运行状态。
