#===================================================================#
# Step 7. League table
#   需要：fit_re、sucra_data（Step 5）、ns_raw（Step 6）、net_graph（Step 2）
#   產出：league_df → league_table_<tag>.csv
#
# 註腳（放在表格說明）：
#   Lower-left: network estimates. Upper-right: direct estimates from node-splitting.
#   Each cell is HR (95% CrI) of row vs column treatment.
#   * Direct evidence only (no indirect evidence; node-splitting not possible);
#     network estimate shown.
#   Blank: no direct evidence.
#===================================================================#

# 藥物順序：SUCRA 由高到低
trts <- sucra_data %>% arrange(desc(sucra)) %>% pull(parameter)
n    <- length(trts)

# 把一組 (a vs b) 估計展開成雙向：反向時取負、上下界對調
both_directions <- function(trt_a, trt_b, est, lo, hi) {
  bind_rows(tibble(a = trt_a, b = trt_b, m = est,  l = lo,  u = hi),
            tibble(a = trt_b, b = trt_a, m = -est, l = -hi, u = -lo))
}

# Network 估計（log 尺度）
ae <- as_tibble(relative_effects(fit_re, all_contrasts = TRUE, probs = c(0.025, 0.975)))
net_long <- both_directions(as.character(ae$.trtb), as.character(ae$.trta),
                            ae$mean, ae$`2.5%`, ae$`97.5%`)
txt_net <- setNames(fmt_hr(net_long$m, net_long$l, net_long$u),
                    paste(net_long$a, net_long$b, sep = "|"))

# Direct 估計（node-splitting 的 d_dir）
dd <- ns_raw %>% filter(par == "d_dir")
d_long <- both_directions(as.character(dd$trt2), as.character(dd$trt1),
                          dd$mean, dd$`2.5%`, dd$`97.5%`)
txt_dir <- setNames(fmt_hr(d_long$m, d_long$l, d_long$u),
                    paste(d_long$a, d_long$b, sep = "|"))

# 哪些比較能拆、哪些邊有 direct 證據
split_keys <- pair_key(as.character(dd$trt1), as.character(dd$trt2))
edges      <- igraph::as_data_frame(net_graph, what = "edges")
edge_keys  <- pair_key(edges$from, edges$to)

league <- matrix("", n, n, dimnames = list(trts, trts))
for (i in seq_len(n)) for (j in seq_len(n)) {
  a <- trts[i]; b <- trts[j]; key <- paste(a, b, sep = "|")
  league[i, j] <- if (i == j) {
    a                                                    # 對角線：藥名
  } else if (i > j) {
    unname(txt_net[key])                                 # 左下：network
  } else {                                               # 右上：direct
    k <- pair_key(a, b)
    if (k %in% split_keys)     unname(txt_dir[key])
    else if (k %in% edge_keys) paste0(unname(txt_net[key]), "*")   # 只有 direct、無法拆
    else                       ""                                  # 沒有 direct 證據
  }
}

league_df <- as_tibble(league, rownames = "Treatment")
print(league_df)
save_table(league_df, "league_table")
