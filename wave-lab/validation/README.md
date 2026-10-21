# Wave Lab / independent numerical validation

Online summary: https://huiw11512-dotcom.github.io/sar-aperture-lab/wave-lab/validation/

## Scope

This is a verification of the browser's **low-power reference propagation model**, not a full-wave validation or measured hardware calibration.

- 10 GHz; free-space wavelength 29.9792458 mm.
- Uniform rectangular aperture 5λ × 5λ, numerical aperture/gain coefficient 0.7, 1 W per virtual source.
- Conservative aperture Fraunhofer threshold using the square's diagonal D: `2D²/λ = 2.99792458 m`. The less conservative one-side estimate is `1.49896229 m`.
- Closed-form single-aperture on-axis peak gain: 219.9115 (23.42 dBi); peak electric field 2.296568 V/m at 50 m; cycle-mean normal flux `7 × 10⁻⁷ W/cm²`, under this formula's assumptions.
- Independent 48×48 scalar aperture quadrature for the integral of `exp(ikR)/R × (1+cos θ)/2`. Compared against the Fraunhofer `sinc × sinc` approximation using the same obliquity approximation. At 50 m: axial complex-field difference 0.78486%; axial amplitude difference 0.001344%. This is **not** an exact vector near-field solver.
- Four-source grid study (positions x,y = ±3 m, H=50 m, target at x=y=0) reproduced the browser vector E,H and normal Poynting equations. For a 50 m wide square, 384² samples underestimate the discrete maximum of the 2048² reference by 14.66868%, even while the area-mean difference is only +0.00148%. The high-resolution discrete maximum is not necessarily the true continuous maximum.
- Cross-language check: after changing the virtual antenna-frame rotation to a continuous `+z → boresight` transform, the browser JavaScript and a separate NumPy implementation agreed at three observer positions in two target geometries to floating-point precision. Common phase invariance and uniform power scaling also passed.

## Open physical issue — angular power normalization

The current model uses `G0 = 4π η_ap A/λ²` with the uniform-aperture sinc-pattern shape and a simplified forward obliquity factor. For η_ap=0.7 the hemispherical angular power integral of the assumed gain pattern is **0.673933 of the reference input**. This cannot be simultaneously interpreted as a rigorous unity radiation-efficiency calibration without specifying a physically consistent aperture taper and its normalization, or measured vector element patterns. As a result, `W/cm²` maps are approximate model values, not experimentally calibrated absolute predictions.

The main application links to the online validation summary; the downloadable reproducibility package includes a separate Python reference calculation, CSV files, and publication-quality figures. The website does not run closed-loop phased target control or interface with RF transmitters.

## Results data

- [Grid-sampling convergence](grid_convergence.csv)
- [Scalar aperture axial comparison](aperture_axial.csv)
- [Validation HTML](index.html)
