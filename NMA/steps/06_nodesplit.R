#===================================================================#
# Step 6. Node-splitting（局部不一致性）
#   需要：net、net_graph
#   產出：nodespilt、ns_raw
#         plot_list → nodesplit1_<tag>.png、nodesplit2_<tag>.png ...
#         incons_tbl → incons_tbl_<tag>.csv（GRADE 用的不一致性表）
#===================================================================#

nodespilt <- run_nma("nodesplit", net, consistency = "nodesplit", seed = cfg$mcmc$seed)

nodespilt_rawdata <- summary(nodespilt)

# 參數名稱去掉方括號後綴："d_dir[AGI vs. SoC]" → "d_dir"
ns_raw <- as_tibble(nodespilt_rawdata) %>%
  mutate(par        = sub("\\[.*$", "", parameter),
         Comparison = paste(trt2, "vs.", trt1))      # 效應方向：trt2 vs trt1

if (nrow(ns_raw) == 0) {
  message("沒有可以拆分的比較（網絡中沒有封閉迴路），略過 node-splitting。")
} else {

#---- 森林圖資料 ----------------------------------------------------
ns_forest <- ns_raw %>%
  filter(par %in% c("d_dir", "d_ind", "d_net")) %>%
  transmute(
    Comparison,
    Type    = recode(par, d_net = "Network", d_dir = "Direct", d_ind = "Indirect"),
    mean    = exp(mean),          # 轉換成 HR
    `2.5%`  = exp(`2.5%`),
    `97.5%` = exp(`97.5%`)
  )

ns_label <- ns_raw %>%
  filter(par == "omega") %>%
  transmute(Comparison,
            p_text  = sprintf("p= %.3f", p_value),
            warning = ifelse(p_value < 0.05, "red", "black"))

comps <- unique(ns_forest$Comparison)

# 每個比較 4 列：標題列（比較名稱與 p 值）＋ Direct / Indirect / Network
final_fp_data <- bind_rows(lapply(comps, function(comp) {
  df_f <- ns_forest %>% filter(Comparison == comp)
  df_l <- ns_label  %>% filter(Comparison == comp)

  row_header <- tibble(
    Subgroup = comp, mean = NA_real_, lower = NA_real_, upper = NA_real_,
    `HR [95% CrI]` = "", `P value` = df_l$p_text[1],
    Type = "header", Comparison = comp, Warning = df_l$warning[1]
  )

  row_data <- df_f %>%
    arrange(match(Type, c("Direct", "Indirect", "Network"))) %>%
    transmute(
      Subgroup = paste0("   ", Type),   # 縮排
      mean, lower = `2.5%`, upper = `97.5%`,
      `HR [95% CrI]` = sprintf("%.2f [%.2f, %.2f]", mean, lower, upper),
      `P value` = "", Type, Comparison = comp, Warning = "black"
    )

  bind_rows(row_header, row_data)
}))

final_fp_data$` ` <- paste(rep(" ", 17), collapse = " ")   # 畫 CI 的空白欄

# 分頁
final_fp_data <- final_fp_data %>%
  left_join(tibble(Comparison = comps,
                   Page = ceiling(seq_along(comps) / cfg$nodesplit_per_page)),
            by = "Comparison") %>%
  select(-Comparison) %>%
  rename(Comparison = Subgroup)

total_pages <- max(final_fp_data$Page)
plot_list   <- list()

for (i in seq_len(total_pages)) {
  page_data <- final_fp_data %>% filter(Page == i)
  n_rows    <- nrow(page_data)

  # 排版矩陣：4 欄（Comparison, HR, 繪圖區, P value）
  # 每 4 列一組：第 1 列標題靠左、粗體、灰底；其餘靠右
  hjust_mat <- matrix(0.5, nrow = n_rows, ncol = 4)
  x_mat     <- matrix(0.5, nrow = n_rows, ncol = 4)
  hjust_mat[, 1] <- rep(c(0, 1, 1, 1), times = n_rows / 4)
  x_mat[, 1]     <- rep(c(0.05, 0.9, 0.9, 0.9), times = n_rows / 4)

  fontface_mat <- matrix("plain", nrow = n_rows, ncol = 4)
  fontface_mat[seq(1, n_rows, by = 4), ] <- "bold"

  color_mat <- matrix("black", nrow = n_rows, ncol = 4)
  color_mat[, 4] <- ifelse(page_data$Warning == "red", "red", "black")   # p<0.05 標紅

  bg_colors <- rep(c("#DFE0E4", "white", "white", "white"), times = n_rows / 4)

  p <- forest(
    data      = page_data[, c("Comparison", "HR [95% CrI]", " ", "P value")],
    est       = page_data$mean,
    lower     = page_data$lower,
    upper     = page_data$upper,
    ci_column = 3,
    ref_line  = 1,
    xlim      = c(0, ceiling(max(ns_forest$`97.5%`))),
    ticks_at  = cfg$nodesplit_ticks,
    footnote  = "P<0.05 indicates potential inconsistency",
    theme = forest_theme(
      base_family = "sans", base_size = 10,
      footnote_gp = gpar(cex = 0.8, fontface = "bold"),
      ci_pch = 15, ci_Theight = 0.2,
      ci_col = "black", ci_fill = "black",
      ci_alpha = 1, ci_lwd = 1.75,
      arrow_label_just = "end",
      arrow_length = 0.06,
      colhead = list(fg_params = list(hjust = 0.5, x = 0.5)),
      core = list(
        bg_params = list(fill = bg_colors),
        fg_params = list(hjust = hjust_mat, x = x_mat,
                         fontface = fontface_mat, col = color_mat)
      )
    )
  )

  # 點與線的顏色依 Direct / Indirect / Network 區分
  # （ci_col 傳多個顏色會讓 legend 報錯，所以逐列修改）
  for (row_idx in seq_len(n_rows)) {
    row_type <- page_data$Type[row_idx]
    if (row_type != "header") {
      point_color <- switch(row_type,
                            "Direct"   = "black",
                            "Indirect" = "gray50",
                            "Network"  = "#2930b1",
                            "black")
      p <- edit_plot(p, row = row_idx, col = 3, which = "ci",
                     gp = gpar(col = point_color, fill = point_color))
    }
  }

  p <- insert_text(
    p,
    text = sprintf("Node-Splitting Analysis (%s, %s) - Page %d of %d",
                   cfg$outcome_label, cfg$analysis_label, i, total_pages),
    col  = 1:4, part = "header", just = "center",
    gp   = gpar(fontface = "bold", fontsize = 11)
  )

  plot_list[[i]] <- p
  plot(p)

  # 高度依列數調整（40 列約 13 cm）
  save_plot(p, paste0("nodesplit", i), width = 8, height = 1 + 0.3 * n_rows)
}


#---- 不一致性表（GRADE 用）------------------------------------------
# omega = d_dir − d_ind，所以 exp(omega) = 直接 HR / 間接 HR
keep <- c("d_dir", "d_ind", "d_net", "omega")

wide <- ns_raw %>%
  filter(par %in% keep) %>%
  mutate(txt = fmt_hr(mean, `2.5%`, `97.5%`)) %>%
  select(Comparison, par, txt) %>%
  pivot_wider(names_from = par, values_from = txt)

om <- ns_raw %>%
  filter(par == "omega") %>%
  transmute(Comparison, p_value,
            omega_excl_null = `2.5%` > 0 | `97.5%` < 0)   # omega 的 CrI 不含 0

conv <- ns_raw %>%
  filter(par %in% keep) %>%
  group_by(Comparison) %>%
  summarise(min_Bulk_ESS = min(Bulk_ESS), min_Tail_ESS = min(Tail_ESS),
            max_Rhat = max(Rhat), .groups = "drop")

edges  <- igraph::as_data_frame(net_graph, what = "edges")   # from, to, .nstudy
nstudy <- edges %>% transmute(key = pair_key(from, to), n_studies = .nstudy)

incons_tbl <- wide %>%
  left_join(om,   by = "Comparison") %>%
  left_join(conv, by = "Comparison") %>%
  mutate(key = vapply(strsplit(Comparison, " vs\\. "),
                      function(x) pair_key(x[1], x[2]), character(1))) %>%
  left_join(nstudy, by = "key") %>%
  transmute(
    Outcome  = cfg$outcome_label,
    Analysis = cfg$analysis_label,
    Comparison,
    `No. direct studies` = n_studies,
    Direct   = d_dir,
    Indirect = d_ind,
    Network  = d_net,
    `Ratio of HRs (direct/indirect)` = omega,
    `Bayesian p` = round(p_value, 3),
    Flag = case_when(p_value < 0.05 | omega_excl_null ~ "Possible inconsistency",
                     p_value < 0.10                   ~ "Borderline (p<0.10)",
                     TRUE                             ~ "No"),
    min_Bulk_ESS, min_Tail_ESS, max_Rhat
  ) %>%
  arrange(`Bayesian p`)

print(incons_tbl)
save_table(incons_tbl, "incons_tbl")

}
