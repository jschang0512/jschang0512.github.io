#===================================================================#
# Step 3. 主模型（隨機效應、consistency）
#   需要：net
#   產出：fit_re、fit_redata → nmadata_<tag>.csv
#         prior_posterior → prior_posterior_<tag>.png
#===================================================================#

fit_re <- run_nma("main", net)

print(fit_re)
fit_redata <- as.data.frame(summary(fit_re))
save_table(fit_redata, "nmadata")

# 先驗 vs 後驗分佈
prior_posterior <- plot_prior_posterior(
  fit_re,
  prior      = c("trt", "het"),   # 治療效應與異質性 τ
  ref_line   = 0,                 # log HR = 0（無效應）
  post_args  = list(fill = "#4C6A92", alpha = 0.75, binwidth = 0.05),
  prior_args = list(colour = "#B5453A", linewidth = 0.9)
) +
  coord_cartesian(xlim = cfg$plot$prior_post_xlim) +  # 先驗太寬會把圖壓扁
  labs(
    title   = sprintf("Prior and posterior distributions (%s, %s)",
                      cfg$outcome_label, cfg$analysis_label),
    x       = sprintf("log hazard ratio vs. %s (τ: between-study SD)", cfg$ref_trt),
    y       = "Density",
    caption = "Red line: prior; Blue histogram: posterior"
  ) +
  theme_bw(base_size = 11) +
  theme(
    plot.title       = element_text(hjust = 0.5, face = "bold"),
    plot.caption     = element_text(hjust = 0.5, colour = "gray30"),
    strip.background = element_rect(fill = "#EEF1F5", colour = NA),
    strip.text       = element_text(face = "bold"),
    panel.grid.minor = element_blank()
  )

prior_posterior
save_plot(prior_posterior, "prior_posterior", width = 8, height = 7)
