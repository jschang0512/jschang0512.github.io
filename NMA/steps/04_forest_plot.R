#===================================================================#
# Step 4. 相對效應森林圖（vs 參考組）
#   需要：fit_re
#   產出：forest、forest_data → forestrawdata_<tag>.csv、forestdata_<tag>.csv
#         forestplot → forestplot_<tag>.png
#===================================================================#

forest <- as.data.frame(relative_effects(fit_re, trt_ref = cfg$ref_trt))

vs_col <- sprintf("(vs %s)", cfg$ref_trt)

forest_data <- forest %>%
  transmute(
    Treatment = strip_param(parameter),
    mean      = exp(mean),         # 轉換成 HR
    `2.5%`    = exp(`2.5%`),
    `97.5%`   = exp(`97.5%`),
    se        = (log(`97.5%`) - log(`2.5%`)) / 3.92
  ) %>%
  arrange(mean) %>%
  mutate(
    !!vs_col := paste(rep(" ", 30), collapse = " "),   # 畫 CI 的空白欄
    `mean HR [95% CrI]` = sprintf("%.2f [%.2f, %.2f]", mean, `2.5%`, `97.5%`)
  )

p <- forest(
  data      = forest_data[, c("Treatment", vs_col, "mean HR [95% CrI]")],
  est       = forest_data$mean,
  lower     = forest_data$`2.5%`,
  upper     = forest_data$`97.5%`,
  ci_column = 2,
  ref_line  = 1,
  arrow_lab = c("Favor Treatment", paste("Favor", cfg$ref_trt)),
  xlim      = cfg$plot$forest_xlim,
  ticks_at  = cfg$plot$forest_ticks,
  theme = forest_theme(
    base_family = "sans", base_size = 10,
    ci_pch = 15, ci_alpha = 1, ci_lwd = 1.5, ci_Theight = 0.2,
    core    = list(fg_params = list(hjust = 1, x = 0.9),
                   bg_params = list(fill = c("#DFE0E4", "white"))),
    colhead = list(fg_params = list(hjust = 0.5, x = 0.5)),
    arrow_label_just = "end",
    arrow_length     = 0.06,
    arrow_gp         = gpar(fontsize = 9)
  )
)

forestplot <- insert_text(
  p,
  text = sprintf("Relative effects of %s", cfg$title),
  col  = 1:3,
  part = "header",
  gp   = gpar(fontface = "bold", fontsize = 11)
)

plot(forestplot)
save_plot(forestplot, "forestplot", width = 7, height = 5)
save_table(forest_data, "forestdata")
save_table(forest, "forestrawdata")
