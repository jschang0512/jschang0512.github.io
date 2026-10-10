
# NMA for neurodegenerative disease of antihyperglycemia drugs #
# 2026-04-30 #
# Package manual: #

#===================================================================#

#1. Check package and install "nma"
pkgCheck <- function(pkg){
  if (!requireNamespace(pkg, quietly = TRUE)) install.packages(pkg)
  library(pkg, character.only = TRUE)
}

pkgCheck("multinma")
pkgCheck("dplyr")
pkgCheck("tidyr")
pkgCheck("rstudioapi")
pkgCheck("ggplot2")
pkgCheck("scales")
pkgCheck("tidyverse")
pkgCheck("patchwork")
pkgCheck("ggsci")
pkgCheck("igraph")
pkgCheck("ggraph")
pkgCheck("grid")
pkgCheck("forestploter")
pkgCheck("ggrepel")
pkgCheck("readxl")



load(file = "I:/我的雲端硬碟/糖尿病&神經退化疾病/Result/all cause dementia_ITT/202601004.Rdata")



#===================================================================#

#2. Load data


rawdata <- read_excel("I:/我的雲端硬碟/糖尿病&神經退化疾病/Data/hrdata.xlsx", sheet="AllCause_ITT") %>%
  select(id, studylab, treat, r, n, logTE, selogTE, Sex, Age, Followup, Region_category, ROBINS, Coeff) %>%
  filter(!is.na(id)) %>%
  mutate(
    `selogTE0.25` = if_else(Coeff %in% "Y", sqrt(selogTE * 0.25), selogTE),
    `selogTE0.5` = if_else(Coeff %in% "Y",sqrt(selogTE * 0.5), selogTE),
    `selogTE0.75` = if_else(Coeff %in% "Y", sqrt(selogTE * 0.75), selogTE)
    )



dm <- as.data.frame(rawdata)


#4 Forming network
net <- set_agd_contrast(
  data = dm,
  study = studylab,
  trt = treat, 
  y = logTE,
  se = `selogTE0.5`)



mcmcset <- list(
  prior_trt = normal(scale = 1.5),
  prior_het = half_normal(scale = 0.5),
  iter = 10000,    # 總抽樣次數
  warmup = 2000,  # 預熱期(捨棄的次數)
  chains = 4     # 跑 4 條馬可夫鏈 (MCMC)
  )


#===================================================================#


#5 Network graph
net_graph <- as.igraph(net) 

netgraph <- ggraph(net_graph, layout = "linear", circular = TRUE) + 
  
  geom_edge_link(
    aes(
      width = .nstudy,
      label = ifelse(.nstudy>1, .nstudy, "")     
    ), 
    angle_calc = 'along',        # 數字順著線條旋轉
    label_dodge = unit(1, 'mm'), # 防撞距離，讓數字不被線條遮擋
    color = "#C9D5D4",            # 線條顏色
    label_size = 4,            # 數字大小
    fontface = "bold",
    label_colour = "black",       # 數字顏色
    label_alpha = 0.7,
    label_pos = 0.44
  ) +
  
  
  geom_node_point(size = 12, color = "#a1adc8", alpha=1) + 
  
  
  geom_node_text(
    aes(
      label = name,
      # 將座標放大 1.15 倍，文字就會往外推離圓心
      x = x * 1.15 , 
      y = y * 1.15,
      # 根據左右半邊自動調整對齊：右邊的字左對齊(0)，左邊的字右對齊(1)
      # 這樣文字才不會跟圓圈重疊
      hjust = ifelse(x > 0, 0, 1)
    ), 
    color = "black",             
    fontface = "bold", 
    size = 4
  ) +
  
  # 設定線條粗細範圍
  scale_edge_width(range = c(1, 10), guide = "none") + 
  
  scale_x_continuous(expand = expansion(mult = 0.2)) +
  scale_y_continuous(expand = expansion(mult = 0.1)) +
  
  coord_fixed() +
  
  # 套用乾淨的空白背景
  theme_void() +
  
  labs(
    title = "All-cause dementia (ITT)",
  ) +
  
  theme(
    plot.title = element_text(hjust = 0.5, face = "bold", size = 16),
    plot.background = element_rect(fill = "white", color = NA),
    panel.background = element_rect(fill = "white", color = NA)
  )

#===================================================================#

#6 set model
fit_re <- nma(
  net,
  consistency = "consistency",
  trt_effects = "random",   # 設定為隨機效應模型 (若要固定效應可改為 "fixed")
  likelihood = "normal",    # 對數風險比 (logHR) 服從常態分佈
  link = "identity",        # 因為已經是 log 尺度，所以不需要額外的轉換
  
  # 設定先驗分佈 (Priors)：提供弱資訊先驗以幫助 Stan 模型順利收斂
  prior_trt = mcmcset$prior_trt,
  prior_het = mcmcset$prior_het, # 異質性標準差(tau)的先驗
  
  # Stan 抽樣設定 (視你的電腦效能與收斂情況可調整)
  iter = mcmcset$iter,
  warmup = mcmcset$warmup,
  chains = mcmcset$chains,
)


prior_posterior <- plot_prior_posterior(
  fit_re,
  prior = c("trt", "het"),                 # 治療效應與異質性 τ
  ref_line = 0,                            # 在 0 畫一條參考線（log HR 無效應）
  post_args  = list(fill = "#4C6A92", alpha = 0.75, binwidth = 0.05),
  prior_args = list(colour = "#B5453A", linewidth = 0.9)
) +
  coord_cartesian(xlim = c(-1.5, 1.5)) +    # 只顯示有資料的範圍，先驗太寬會把圖壓扁
  labs(
    title = "Prior and posterior distributions (All-cause dementia, ITT)",
    x = "log hazard ratio vs. SoC (τ: between-study SD)",
    y = "Density",
    caption = "Red line: prior; Blue histogram: posterior"
  ) +
  theme_bw(base_size = 11) +
  theme(
    plot.title   = element_text(hjust = 0.5, face = "bold"),
    plot.caption = element_text(hjust = 0.5, colour = "gray30"),
    strip.background = element_rect(fill = "#EEF1F5", colour = NA),
    strip.text   = element_text(face = "bold"),
    panel.grid.minor = element_blank()
  )



print(fit_re)
fit_redata <- as.data.frame(summary(fit_re))

#===================================================================#

#Draw forest plot
rel_eff <- relative_effects(fit_re, trt_ref = "SoC")
forest <- as.data.frame(rel_eff) #轉換資料格式


#畫 Forest plot

forest_data <- forest %>% #資料清理
  select(-.trta, -.trtb) %>%
  mutate(parameter = sub("d\\[", "", parameter)) %>%
  mutate(parameter = sub("\\]", "", parameter)) %>%
  mutate(mean = exp(mean), #轉換成HR
         `2.5%` = exp(`2.5%`),
         `25%` = exp(`25%`),
         `50%` = exp(`50%`),
         `75%` = exp(`75%`),
         `97.5%` = exp(`97.5%`),
         se = (log(`97.5%`)-log(`2.5%`))/3.92
         ) %>%
  rename(Treatment = parameter)%>%
  select(Treatment, mean, `2.5%`, `97.5%`, se)%>%
  arrange(mean)
forest_data$`(vs SoC)` <- paste(rep(" ", 30), collapse = " ")
forest_data$`mean HR [95% CrI]` <-  sprintf("%.2f [%.2f, %.2f]", forest_data$mean, forest_data$`2.5%`, forest_data$`97.5%`)
p <- forest(
  data = forest_data[,c(1, 6:7)],
  est = forest_data$mean,
  lower = forest_data$`2.5%`,
  upper = forest_data$`97.5%`,
  se = forest_data$se,
  ci_column = 2,
  ref_line = 1,
  arrow_lab = c("Favor Treatment", "Favor SoC"),
  xlim = c(0, 2),
  tick_at = c(0.5, 2, by=0.5),
  theme = forest_theme(
    base_family = "sans", base_size = 10,
    #信賴區間
    ci_pch = 15,
    ci_alpha = 1,
    ci_lwd = 1.5,
    ci_Theight = 0.2,
    #內容
    core = list(fg_params = list(hjust = 1, x = 0.9),
                bg_params = list(fill = c("#DFE0E4", "white" ))),
    colhead = list(fg_params = list(hjust = 0.5, x = 0.5)),
    
    arrow_label_just = "end",
    arrow_length = 0.06,
    arrow_gp = gpar(fontsize = 9)
  )
) 

forestplot <- insert_text(p,
                          text = "Relative effects of all-cause dementia (ITT)",
                          col = 1:3,
                          part = "header",
                          gp = gpar(fontface = "bold",
                                    fontsize = 11))
                    
#===================================================================#

#Rank
ranks <- posterior_ranks(fit_re, lower_better = TRUE)

rank_mod <- as.data.frame(ranks)
print(rank_mod)

rank_mod <- rank_mod %>%
  select(parameter, mean, `2.5%`, `50%`, `97.5%`) %>%
  mutate(parameter = sub('rank\\[', "", parameter)) %>%
  mutate(parameter = sub('\\]', "", parameter))%>%
  arrange(`50%`)

#Rank graph (這個不一定要放可以放 rankmod 的 table)
plot(ranks) +
  ggplot2::labs(title = "Rank")

#Rank probability
rank_probs_cum <- posterior_rank_probs(fit_re, lower_better = TRUE, cumulative = TRUE, sucra = TRUE)

# Rankogram
rankprob_cum <- as.data.frame(rank_probs_cum)
rankprob_plot <- rankprob_cum %>%
  select(-.trt) %>%
  mutate(parameter = sub(".*\\[(.*?)\\].*", "\\1", parameter)) %>%
  
  #換成長表
  pivot_longer(
    cols = starts_with("p_rank"),
    names_to = "Rank",
    values_to = "Cumulative_Probability"
  ) %>%
  
  mutate(Rank = as.numeric(gsub("p_rank\\[([0-9]+)\\]", "\\1", Rank)))


rankogram <- ggplot(rankprob_plot,
                    aes(x = Rank, y = Cumulative_Probability, color = parameter))+
  geom_line(linewidth = 1.2)+
  geom_point(size = 4)+
  
  
  scale_color_igv()+
  scale_y_continuous(labels = percent_format(), limits = c(0,1))+
  scale_x_continuous(breaks = 1:10)+
  
  labs(
    x = "Rank",
    y = "Cumulative Probability",
  )+
  
  guides(
    color = guide_legend(ncol = 5)
  )+
  
  theme_classic()+
  theme(legend.position = "bottom",
        legend.title = element_blank(),
        axis.title = element_text(face = "bold" )
        )


sucra_data <- rankprob_cum %>%
  select(parameter, sucra) %>%
  mutate(parameter = sub(".*\\[(.*?)\\].*", "\\1", parameter),
         sucra = sucra*100)

sucra <- ggplot(sucra_data,
               aes(x= reorder(parameter, -sucra)
                   , y=sucra)
               )+
  geom_col(fill = "gray20")+
  labs(
    x = "Medication",
    y = "SUCRA (%)"
  )+
  geom_text(aes(label = round(sucra,2)), 
            vjust = 1.2,
            color = "white",
            fontface = "bold")+

    theme_minimal()+
  theme(
    axis.text = element_text(size = 9, color = "black"),
    axis.title = element_text(face = "bold")
  )

# Rank 的所有圖片
rankplot <- rankplot <-rankogram /sucra+ 
  plot_annotation(
    title = "Medication ranking for all-cause dementia (ITT)",
    tag_levels = "A"
  ) +
  plot_layout(heights = c(3,1))&
  theme(plot.title = element_text(hjust = 0.5, face = "bold"))

#===================================================================#
  
#node spilt
  nodespilt <- nma(
    net,
    seed=12345,
    consistency = "nodesplit",
    trt_effects = "random",   # 設定為隨機效應模型
    likelihood = "normal",    # 對數風險比 (logHR) 服從常態分佈
    link = "identity",        # 因為已經是 log 尺度，所以不需要額外的轉換
    
    # 設定先驗分佈 (Priors)：提供弱資訊先驗以幫助 Stan 模型順利收斂
    prior_trt = mcmcset$prior_trt,
    prior_het = mcmcset$prior_het, # 異質性標準差(tau)的先驗
    
    # Stan 抽樣設定 (視你的電腦效能與收斂情況可調整)
    iter = mcmcset$iter,
    warmup = mcmcset$warmup,
    chains = mcmcset$chains,
  )
  


# 整理Nodesplit 結果
nodespilt_rawdata <- summary(nodespilt)

# 展開 summary
nodespilt_flatdata <- nodespilt_rawdata %>%
  as_tibble() %>%
  mutate(Comparison = paste(trt2, "vs.", trt1),
         mean = exp(mean), #轉換成HR
         `2.5%` = exp(`2.5%`),
         `25%` = exp(`25%`),
         `50%` = exp(`50%`),
         `75%` = exp(`75%`),
         `97.5%` = exp(`97.5%`)) %>%
  relocate(Comparison, before = 1) %>%
  select(Comparison, parameter, mean, sd, `2.5%`, `50%`, `97.5%`,p_value)

#給 forest plot 的數據
nodespilt_forest <- nodespilt_flatdata %>%
  filter(str_detect(parameter, "d_ind|d_dir|d_net")) %>%
  mutate(
    Type = case_when(
      str_detect(parameter, "d_net") ~ "Network",
      str_detect(parameter, "d_dir") ~ "Direct",
      str_detect(parameter, "d_ind") ~ "Indirect"),
    Type = factor(Type, levels = c("Network","Indirect", "Direct"))) %>%
  select(Comparison, Type, mean, `2.5%`, `97.5%`)

nodespilt_label <- nodespilt_flatdata %>%
  filter(str_detect(parameter, "omega")) %>%
  mutate(
    p_text = sprintf("p= %.3f", p_value),
    omega_text = sprintf("%.2f [%.2f, %.2f]", mean, `2.5%`, `97.5%`),
    warning = ifelse(p_value < 0.05, "red", "black"),
    Type = factor("Indirect", levels = c("Network", "Indirect", "Direct"))
  ) %>%
  rename(`P value` = p_value)

# Node split
prep_data <- list()
comps <- unique(nodespilt_forest$Comparison)

for (comp in comps) {
  # 抓取該 Comparison 的圖表資料與標籤資料
  df_f <- nodespilt_forest %>% filter(Comparison == comp)
  df_l <- nodespilt_label %>% filter(Comparison == comp)
  
  # 建立第一列：標題列 (顯示 Comparison 名稱與 p-value)
  row_header <- tibble(
    Subgroup = comp,  
    mean = NA_real_,
    lower = NA_real_,
    upper = NA_real_,
    `HR [95% CrI]` = "",
    `P value` = df_l$p_text[1], # 把 p-value 放在標題列右側
    Type = "header",
    Comparison = comp,
    Warning = df_l$warning[1]   # 記錄 p-value 是否小於 0.05
  )
  
  # 建立後三列：Direct, Indirect, Network 資料列
  row_data <- df_f %>%
    # 按照順序排列
    arrange(match(Type, c("Direct", "Indirect", "Network"))) %>%
    mutate(
      Subgroup = paste0("   ", Type), # 縮排，讓視覺上有從屬感
      lower = `2.5%`,
      upper = `97.5%`,
      `HR [95% CrI]` = sprintf("%.2f [%.2f, %.2f]", mean, lower, upper),
      `P value` = "",
      Type = as.character(Type),
      Comparison = comp,
      Warning = "black"
    ) %>%
    select(Subgroup, mean, lower, upper, `HR [95% CrI]`, `P value`, Type, Comparison, Warning)
  
  # 將標題列與資料列綁在一起
  prep_data[[comp]] <- bind_rows(row_header, row_data)
}

final_fp_data <- bind_rows(prep_data)

# 加入用來畫圖的「空白欄位」 (在表格中間騰出空間)
final_fp_data$` ` <- paste(rep(" ", 17), collapse = " ")

max_page = 10

# 重新分配分頁
comp_page_mapping <- tibble(
  Comparison = comps,
  Page = ceiling(seq_along(comps) / max_page)
)
final_fp_data <- final_fp_data %>% 
  left_join(comp_page_mapping, by = "Comparison") %>%
  select(-Comparison)%>%
  rename(Comparison = Subgroup)


plot_list <- list()
total_pages <- max(final_fp_data$Page)

for (i in 1:total_pages) {
  # 篩選該頁資料
  page_data <- final_fp_data %>% filter(Page == i)
  n_rows <- nrow(page_data) # 計算這頁有幾列
  
  # 🌟【製作排版矩陣 (Theme Matrices)】🌟
  # 您的表格共有 4 個欄位：Subgroup, HR, (空白繪圖區), p-value
  
  # 1. 對齊與座標矩陣 (預設全部 0.5 置中)
  hjust_mat <- matrix(0.5, nrow = n_rows, ncol = 4)
  x_mat     <- matrix(0.5, nrow = n_rows, ncol = 4)
  
  # 針對第 1 欄 (Subgroup)：每 4 列一組，第1列靠左(0)，第2~4列靠右(1)
  hjust_mat[, 1] <- rep(c(0, 1, 1, 1), times = n_rows / 4)
  x_mat[, 1]     <- rep(c(0.05, 0.9, 0.9, 0.9), times = n_rows / 4)
  
  # 2. 字體粗細矩陣：每 4 列一組，第1列標題粗體 (bold)，其他正常 (plain)
  fontface_mat <- matrix("plain", nrow = n_rows, ncol = 4)
  fontface_mat[seq(1, n_rows, by = 4), ] <- "bold" # 把標題那整列變粗體
  
  # 3. 字體顏色矩陣：預設全黑，若 P-value 有警告就變紅
  color_mat <- matrix("black", nrow = n_rows, ncol = 4)
  color_mat[, 4] <- ifelse(page_data$Warning == "red", "red", "black")
  
  # 4. 背景顏色向量：每 4 列一組，第1列淺藍，第2~4列白色
  bg_colors <- rep(c("#DFE0E4", "white", "white", "white"), times = n_rows / 4)
  
  
  # 🌟【畫圖：將設定套入 theme】🌟
  p <- forest(
    data = page_data[, c("Comparison", "HR [95% CrI]", " ", "P value")],
    est = page_data$mean,
    lower = page_data$lower,
    upper = page_data$upper,
    ci_column = 3,       
    ref_line = 1,        
    xlim = c(0, ceiling(max(nodespilt_forest$`97.5%`))),
    ticks_at = c(0.5, 1, 1.5, 3), 
    footnote = "P<0.05 indicates potential inconsistency",
    theme = forest_theme(
      base_family = "sans", base_size = 10,
      footnote_gp = gpar(cex = 0.8, fontface = "bold"),
      ci_pch = 15, ci_Theight = 0.2,            
      ci_col = "black", ci_fill = "black", # 森林圖的點線先設黑，待會單獨改
      ci_alpha = 1, ci_lwd = 1.75,
            arrow_label_just = "end",
      arrow_length = 0.06,
      
      # 表頭 (Column Header) 全置中
      colhead = list(fg_params = list(hjust = 0.5, x = 0.5)),

      # 內容 (Core) 套用我們剛剛做好的矩陣與向量！
      core = list(
        bg_params = list(fill = bg_colors),
        fg_params = list(
          hjust    = hjust_mat,
          x        = x_mat,
          fontface = fontface_mat,
          col      = color_mat
        )
      )
    )
  )
  
  # 🌟【唯一保留的 edit_plot：只用來改點和線的顏色】🌟
  # 因為 ci_col 傳入多個顏色會觸發 legend_value 的報錯，所以點線顏色依然保留單獨處理
  for (row_idx in 1:nrow(page_data)) {
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
  
  # 加上大標題
  p <- insert_text(
    p,
    text = paste0("Node-Splitting Analysis (All-cause dementia, ITT) - Page ", i, " of ", total_pages),
    col = 1:4, 
    part = "header",
    just = "center", # 大標題置中
    gp = gpar(fontface = "bold", fontsize = 11)
  )
  
  plot_list[[i]] <- p
}

plot_list[[2]]



#====League Table===================#

outcome_label  <- "All-cause dementia"
analysis_label <- "ITT"

# ---- 共用函數 -----------------------------------------------------------
fmt_hr   <- function(m, l, u) sprintf("%.2f [%.2f, %.2f]", exp(m), exp(l), exp(u))
pair_key <- function(a, b) paste(pmin(a, b), pmax(a, b), sep = "|")   # 無方向配對鍵

# ---- node-splitting 結果整理（去掉 parameter 的方括號後綴）-------------
ns_raw <- as_tibble(nodespilt_rawdata) %>%
  mutate(par = sub("\\[.*$", "", parameter),        # "d_dir[AGI vs. SoC]" → "d_dir"
         Comparison = paste(trt2, "vs.", trt1))     # 效應方向：trt2 vs trt1

# ---- 藥物順序：SUCRA 由高到低 -------------------------------------------
trts <- sucra_data %>% arrange(desc(sucra)) %>% pull(parameter)
n <- length(trts)

# ---- Network 估計（log 尺度），含雙向 ------------------------------------
all_eff <- relative_effects(fit_re, all_contrasts = TRUE, probs = c(0.025,0.975))

all_eff <- as_tibble(all_eff)
ae <- as_tibble(all_eff)
net_fw <- tibble(a = as.character(ae$.trtb), b = as.character(ae$.trta),   # .trtb vs .trta
                 m = ae$mean, l = ae$`2.5%`, u = ae$`97.5%`)
net_long <- bind_rows(
  net_fw,
  tibble(a = net_fw$b, b = net_fw$a, m = -net_fw$m, l = -net_fw$u, u = -net_fw$l)  # 反向：取負、上下界對調
)
txt_net <- setNames(fmt_hr(net_long$m, net_long$l, net_long$u),
                    paste(net_long$a, net_long$b, sep = "|"))

# ---- Direct 估計（d_dir），含雙向 ---------------------------------------
dd <- ns_raw %>% filter(par == "d_dir")
d_fw <- tibble(a = as.character(dd$trt2), b = as.character(dd$trt1),
               m = dd$mean, l = dd$`2.5%`, u = dd$`97.5%`)
d_long <- bind_rows(
  d_fw,
  tibble(a = d_fw$b, b = d_fw$a, m = -d_fw$m, l = -d_fw$u, u = -d_fw$l)
)
txt_dir <- setNames(fmt_hr(d_long$m, d_long$l, d_long$u),
                    paste(d_long$a, d_long$b, sep = "|"))

# ---- 哪些比較能拆、哪些邊有 direct 證據 ---------------------------------
split_keys <- pair_key(as.character(dd$trt1), as.character(dd$trt2))
edges      <- igraph::as_data_frame(net_graph, what = "edges")   # from, to, .nstudy
edge_keys  <- pair_key(edges$from, edges$to)

# ---- 組成 league table 矩陣 ----------------------------------------------
league <- matrix("", n, n, dimnames = list(trts, trts))
for (i in seq_len(n)) for (j in seq_len(n)) {
  a <- trts[i]; b <- trts[j]; key <- paste(a, b, sep = "|")
  league[i, j] <- if (i == j) {
    a                                                   # 對角線：藥名
  } else if (i > j) {
    unname(txt_net[key])                                # 左下：network
  } else {                                              # 右上：direct
    k <- pair_key(a, b)
    if (k %in% split_keys)     unname(txt_dir[key])
    else if (k %in% edge_keys) paste0(unname(txt_net[key]), "*")  # 只有 direct、無法拆：顯示 network 估計
    else                       ""                      # 沒有 direct 證據
  }
}
league_df <- as_tibble(league, rownames = "Treatment")

# 註腳（放在圖表說明）：
# Lower-left: network estimates. Upper-right: direct estimates from node-splitting.
# Each cell is HR (95% CrI) of row vs column treatment.
# † Direct evidence only (no indirect evidence; node-splitting not possible); network estimate shown.
# — No direct evidence.




# ==== 不一致性表 For Grade========
# omega = d_dir − d_ind（由輸出驗證：AGI vs SoC 0.00 − 0.42 ≈ −0.41），
# 所以 exp(omega) = 直接 HR / 間接 HR
keep <- c("d_dir", "d_ind", "d_net", "omega")

wide <- ns_raw %>%
  filter(par %in% keep) %>%
  mutate(txt = fmt_hr(mean, `2.5%`, `97.5%`)) %>%
  select(Comparison, par, txt) %>%
  pivot_wider(names_from = par, values_from = txt)

om <- ns_raw %>% filter(par == "omega") %>%
  transmute(Comparison, p_value,
            omega_excl_null = `2.5%` > 0 | `97.5%` < 0)     # omega 的 CrI 是否不含 0

conv <- ns_raw %>%
  filter(par %in% keep) %>%
  group_by(Comparison) %>%
  summarise(min_Bulk_ESS = min(Bulk_ESS), min_Tail_ESS = min(Tail_ESS),
            max_Rhat = max(Rhat), .groups = "drop")

nstudy <- edges %>% transmute(key = pair_key(from, to), n_studies = .nstudy)

incons_tbl <- wide %>%
  left_join(om,   by = "Comparison") %>%
  left_join(conv, by = "Comparison") %>%
  mutate(key = vapply(strsplit(Comparison, " vs\\. "),
                      function(x) pair_key(x[1], x[2]), character(1))) %>%
  left_join(nstudy, by = "key") %>%
  transmute(
    Outcome = outcome_label, Analysis = analysis_label,
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




#===================================================================#

# Global consistency test (ume)

fit_ume <- nma(
  net,
  consistency = "ume",
  trt_effects = "random",   # 設定為隨機效應模型 (若要固定效應可改為 "fixed")
  likelihood = "normal",    # 對數風險比 (logHR) 服從常態分佈
  link = "identity",        # 因為已經是 log 尺度，所以不需要額外的轉換
  
  # 設定先驗分佈 (Priors)：提供弱資訊先驗以幫助 Stan 模型順利收斂
  prior_trt = mcmcset$prior_trt,
  prior_het = mcmcset$prior_het, # 異質性標準差(tau)的先驗
  
  # Stan 抽樣設定 (視你的電腦效能與收斂情況可調整)
  iter = mcmcset$iter,
  warmup = mcmcset$warmup,
  chains = mcmcset$chains,
)

# 3. 計算並比較兩個模型的 DIC 
dic_cons <- dic(fit_re)
dic_ume <- dic(fit_ume)
condic <- dic_cons$dic
umedic <- dic_ume$dic
delta_dic <- condic-umedic
label_text <- sprintf("Consistency model DIC: %.2f | UME model DIC: %.2f\nΔ DIC: %.2f",
                      condic, umedic, delta_dic)

# 印出結果進行比較
print(dic_cons)
print(dic_ume)




# 4. 視覺化比較殘差 (Deviance-Deviance plot)
# 這可以幫助你看出是哪個研究/哪一臂導致了不一致性

ume_plot <- plot(dic_cons, dic_ume, point_alpha = 0.7, interval_alpha = 0.15,
                 color = "#000080")+

  labs(x = "Residual deviance from consistency model",
       y = "Residual deviance from unrelated mean effects model (UME)",
       title = "Global Inconsistency Analysis (All-cause dementia, ITT) ",
       caption = label_text
  )+

  theme_bw() + 
  theme(
    plot.title = element_text(hjust = 0.5, face = "bold"),
    plot.caption = element_text(hjust = 0.5, face = "bold", 
                                color = "gray30" ,lineheight = 1.2)
    )
  
  

#離差-槓桿圖
dicplot_nolabel<- plot(
  dic_cons,
  type = "leverage",
  dic_contours = 1:4,
  )

dicplot_nolabel$data <- dicplot_nolabel$data %>%
  mutate(`DIC level` = case_when(
    (ssrd^2+ leverage )>= 3 ~"DIC>=3",
    (ssrd^2+ leverage )>= 2 & (ssrd^2+ leverage )< 3 ~"3>DIC>=2",
    (ssrd^2+ leverage )< 2 ~"DIC<2"
  ))

dicplot <- dicplot_nolabel+
  aes(colour = `DIC level`) + 
  scale_colour_manual(values = c("DIC>=3" = "red", "3>DIC>=2" = "blue" ,"DIC<2" = "black")) +
  theme(legend.position = "none")+
  
  geom_text_repel(data = subset(dicplot_nolabel$data, `DIC level` %in% c("DIC>=3", "3>DIC>=2")),
                  aes(x = ssrd, y = leverage, label = .label),
                  fontface = "bold",
                  size = 2.5,
                
                  box.padding = 0.8,       # 增加文字標籤周圍的「保護區」距離
                  point.padding = 0.25,     # 標籤與點之間的最小距離
                  force = 1.5,               # 排斥力大小，越大標籤彈得越遠
                  nudge_x = -0.1,           # 讓標籤初始位置稍微往上一點，比較好排開
                  segment.color = "grey30",# 標籤與點之間引導線的顏色
                  segment.size = 0.3,      # 引導線的粗細
                  min.segment.length = 0,  # 只要有距離就畫引導線（設為 0 表示不省略任何線）
                  max.overlaps = Inf       # 強制顯示所有標籤，不論重疊多嚴重
                  )+
  labs(title = "Deviance-Leverage plot (All-cause dementia, ITT)")+
  theme_bw()+
  theme(
    legend.title = element_blank(),
    legend.position = "bottom",
    plot.title =element_text(hjust = 0.5, face = "bold")
  )


#===================================================================#


#### Transitivity check #####
############################################################
# Transitivity 評估(Belavý 2024 方法;只出表格)
# 前提:rawdata 已讀入,且含欄位
#   studylab, treat, Sex, Age, Followup, Region_category, ROBINS
# 換 outcome 時:只改 tag 與 out_dir,並確認 rawdata 讀的是對應 sheet
############################################################

## ---- 0. 設定 ----

mods_num <- c("Age", "Sex", "Followup")                 # 連續型 modifier(做檢定)
mods_cat <- c("Region_category", "ROBINS")              # 類別型 modifier(只做次數描述)

# 取一個 study 內第一個非 NA 值(研究層級特徵在每個 arm 重複,空白列為 NA)
first_nonNA <- function(x){ x <- x[!is.na(x)]; x[1] }

## ---- 1. 建立三種分析單位 ----
# 1-1 每個 study × drug 一列(去掉空白分隔列與重複)
tr_arms0 <- as.data.frame(rawdata) %>%
  filter(!is.na(treat)) %>%
  transmute(studylab, treat = as.character(treat)) %>%
  distinct()

# 1-2 每個 study 一列的特徵(study 是真正的獨立單位,共 38 篇)
tr_study <- as.data.frame(rawdata) %>%
  group_by(studylab) %>%
  summarise(across(all_of(c(mods_num, mods_cat)), first_nonNA), .groups = "drop")

# 1-3 Node 層級:study × drug,附上研究特徵
tr_arms <- tr_arms0 %>% left_join(tr_study, by = "studylab")

# 1-4 Comparison 層級:同一研究內所有藥物兩兩配對
#     (多臂研究會展開成多個配對;treat1 < treat2 避免 A-B、B-A 重複)
tr_pairs <- tr_arms0 %>%
  inner_join(tr_arms0, by = "studylab", suffix = c("1", "2"),
             relationship = "many-to-many") %>%
  filter(treat1 < treat2) %>%
  transmute(studylab, comparison = paste(treat1, "vs.", treat2)) %>%
  left_join(tr_study, by = "studylab")

## ---- 2. 描述表(Node 與 Comparison)----
fmt_rng <- function(x){                                  # 中位數 (最小-最大)
  x <- x[!is.na(x)]
  if (!length(x)) return("NA")
  sprintf("%.1f (%.1f-%.1f)", median(x), min(x), max(x))
}

describe_by <- function(df, key){
  df %>%
    group_by(.data[[key]]) %>%
    summarise(
      k = n_distinct(studylab),                          # 研究數
      `Age, median (range)`         = fmt_rng(Age),
      `Male %, median (range)`      = fmt_rng(Sex),
      `Follow-up y, median (range)` = fmt_rng(Followup),
      `Follow-up n/k` = sprintf("%d | %d", n_distinct(studylab[!is.na(Followup)]), n_distinct(studylab)),
      `Western n/k`   = sprintf("%d | %d", sum(Region_category == "Western", na.rm = TRUE), sum(!is.na(Region_category))),
      `ROB L/M/S`     = paste0(sum(ROBINS == "Low", na.rm = TRUE), " | ",
                               sum(ROBINS == "Moderate", na.rm = TRUE), " | ",
                               sum(ROBINS == "Serious", na.rm = TRUE)),
      .groups = "drop") %>%
    arrange(desc(k))
}

trans_node <- describe_by(tr_arms,  "treat")      %>% rename(Node = treat)
trans_comp <- describe_by(tr_pairs, "comparison") %>% rename(Comparison = comparison)

## ---- 3. 組間差異檢定(Belavý 規則)----
# 只納入「該 modifier 有值、且該組 ≥2 個研究」的組別
keep_groups <- function(df, key, m){
  df %>%
    filter(!is.na(.data[[m]])) %>%
    group_by(.data[[key]]) %>%
    filter(n_distinct(studylab) >= 2) %>%
    ungroup()
}

# Shapiro-Wilk 檢查 ANOVA 殘差是否常態:
#   p ≥ 0.05 → ANOVA;否則 → Kruskal-Wallis
test_belavy <- function(df, key, m){
  dd <- keep_groups(df, key, m)
  if (n_distinct(dd[[key]]) < 2) return(tibble(groups = n_distinct(dd[[key]])))
  f  <- as.formula(paste(m, "~ factor(", key, ")"))
  an <- aov(f, data = dd)
  sh <- tryCatch(shapiro.test(residuals(an))$p.value, error = function(e) NA_real_)
  use_anova <- !is.na(sh) && sh >= 0.05
  tibble(groups    = n_distinct(dd[[key]]),
         Shapiro_p = sh,
         Test      = if (use_anova) "ANOVA" else "Kruskal-Wallis",
         p         = if (use_anova) summary(an)[[1]][["Pr(>F)"]][1]
         else kruskal.test(f, data = dd)$p.value)
}

trans_tests <- bind_rows(lapply(mods_num, function(m){
  bind_rows(
    test_belavy(tr_arms,  "treat",      m) %>% mutate(Level = "Node"),
    test_belavy(tr_pairs, "comparison", m) %>% mutate(Level = "Comparison")
  ) %>% mutate(Modifier = m, .before = 1)
})) %>%
  select(Modifier, Level, groups, Shapiro_p, Test, p) %>%
  mutate(across(c(Shapiro_p, p), ~ round(.x, 3)))


print(trans_node); print(trans_comp); print(trans_tests)

  
  
##### NMR ###########

sex <- as.data.frame(rawdata) %>%
    filter(!is.na(Sex))
   
  
age <- as.data.frame(rawdata) %>%
    filter(!is.na(Age))

fw <- as.data.frame(rawdata) %>%
  filter(!is.na(Followup))

region <- as.data.frame(rawdata) %>%
  filter(!is.na(Region_category))

rob <- as.data.frame(rawdata) %>%
  filter(!is.na(ROBINS))

netsex <- set_agd_contrast(
    data = sex,
    study = studylab,
    trt = treat,
    trt_ref = "SoC", 
    y = logTE,
    se = `selogTE0.5`)

netage <- set_agd_contrast(
  data = age,
  study = studylab,
  trt = treat,
  trt_ref = "SoC", 
  y = logTE,
  se = `selogTE0.5`)

netfw <- set_agd_contrast(
  data = fw,
  study = studylab,
  trt = treat,
  trt_ref = "SoC", 
  y = logTE,
  se = `selogTE0.5`)

netregion <- set_agd_contrast(
  data = region,
  study = studylab,
  trt = treat,
  trt_ref = "SoC", 
  y = logTE,
  se = `selogTE0.5`)


netrob <- set_agd_contrast(
  data = rob,
  study = studylab,
  trt = treat,
  trt_ref = "SoC", 
  y = logTE,
  se = `selogTE0.5`)
  
sex_reg <- nma(netsex, 
               regression = ~.trt:Sex, # .t 代表治療效應
               trt_effects = "random",
               prior_trt = mcmcset$prior_trt,
               prior_reg = normal(scale = 1),
               prior_het = mcmcset$prior_het,
               iter  = mcmcset$iter,
               warmup = mcmcset$warmup,
               chains=mcmcset$chains,
               control = list(max_treedepth = 15,adapt_delta = 0.99))

age_reg <- nma(netage, 
               regression = ~.trt:Age, # .t 代表治療效應
               trt_effects = "random",
               prior_trt = mcmcset$prior_trt,
               prior_reg = normal(scale = 1),
               prior_het = mcmcset$prior_het,
               iter  = mcmcset$iter,
               warmup = mcmcset$warmup,
               chains=mcmcset$chains,
               control = list(max_treedepth = 15,adapt_delta = 0.99))

fw_reg <- nma(netfw, 
              regression = ~.trt:Followup, # .t 代表治療效應
              trt_effects = "random",
              prior_trt = mcmcset$prior_trt,
              prior_reg = normal(scale = 1),
              prior_het = mcmcset$prior_het,
              iter  = mcmcset$iter,
              warmup = mcmcset$warmup,
              chains=mcmcset$chains,
              control = list(max_treedepth = 15,adapt_delta = 0.99))

region_reg <- nma(netregion, 
                  regression = ~.trt:Region_category, # .t 代表治療效應
                  trt_effects = "random",
                  prior_trt = mcmcset$prior_trt,
                  prior_reg = normal(scale = 1),
                  prior_het = mcmcset$prior_het,
                  iter  = mcmcset$iter,
                  warmup = mcmcset$warmup,
                  chains=mcmcset$chains,
                  control = list(max_treedepth = 15,adapt_delta = 0.99))

rob_reg <- nma(netrob, 
               regression = ~.trt:ROBINS, # .t 代表治療效應
               trt_effects = "random",
               prior_trt = mcmcset$prior_trt,
               prior_reg = normal(scale = 1),
               prior_het = mcmcset$prior_het,
               iter  = mcmcset$iter,
               warmup = mcmcset$warmup,
               chains=mcmcset$chains,
               control = list(max_treedepth = 15,adapt_delta = 0.99))





sexreg_data <- as.data.frame(summary(sex_reg))%>%
  mutate(`mean(95%CI)` = ifelse(parameter == "tau", sprintf("%.3f [%.3f, %.3f]", mean, `2.5%`, `97.5%`)
                              ,sprintf("%.3f [%.3f, %.3f]", exp(mean), exp(`2.5%`), exp(`97.5%`))) )%>%
  select(parameter, `mean(95%CI)`, Bulk_ESS, Tail_ESS, Rhat)

agereg_data <- as.data.frame(summary(age_reg))%>%
  mutate(`mean(95%CI)` = ifelse(parameter == "tau", sprintf("%.3f [%.3f, %.3f]", mean, `2.5%`, `97.5%`)
                                ,sprintf("%.3f [%.3f, %.3f]", exp(mean), exp(`2.5%`), exp(`97.5%`))) )%>%
  select(parameter, `mean(95%CI)`, Bulk_ESS, Tail_ESS, Rhat)

fwreg_data <- as.data.frame(summary(fw_reg))%>%
  mutate(`mean(95%CI)` = ifelse(parameter == "tau", sprintf("%.3f [%.3f, %.3f]", mean, `2.5%`, `97.5%`)
                                ,sprintf("%.3f [%.3f, %.3f]", exp(mean), exp(`2.5%`), exp(`97.5%`))) )%>%
  select(parameter, `mean(95%CI)`, Bulk_ESS, Tail_ESS, Rhat)

regionreg_data <- as.data.frame(summary(region_reg))%>%
  mutate(`mean(95%CI)` = ifelse(parameter == "tau", sprintf("%.3f [%.3f, %.3f]", mean, `2.5%`, `97.5%`)
                                ,sprintf("%.3f [%.3f, %.3f]", exp(mean), exp(`2.5%`), exp(`97.5%`))) )%>%
  select(parameter, `mean(95%CI)`, Bulk_ESS, Tail_ESS, Rhat)

robreg_data <- as.data.frame(summary(rob_reg))%>%
  mutate(`mean(95%CI)` = ifelse(parameter == "tau", sprintf("%.3f [%.3f, %.3f]", mean, `2.5%`, `97.5%`)
                                ,sprintf("%.3f [%.3f, %.3f]", exp(mean), exp(`2.5%`), exp(`97.5%`))) )%>%
  select(parameter, `mean(95%CI)`, Bulk_ESS, Tail_ESS, Rhat)


#### NMR 結果整理
# ---------- 1. 從各模型抽出 beta 與 tau ----------
fits <- list(Sex = sex_reg, Age = age_reg, `Follow-up` = fw_reg,
             Region = region_reg, ROB = rob_reg)

extract_beta <- function(fit, cov) {
  as.data.frame(summary(fit)) %>%
    filter(str_detect(parameter, "^beta\\[")) %>%
    mutate(
      Drug = str_match(parameter, "\\.trt([^:]+):")[, 2],
      term = str_match(parameter, ":(.+)\\]$")[, 2],
      Covariate = case_when(
        cov == "ROB"    & str_detect(term, "Moderate") ~ "ROBINS-I: Moderate vs Low",
        cov == "ROB"    & str_detect(term, "Serious")  ~ "ROBINS-I: Serious vs Low",
        cov == "Region"                                ~ "Region: Western vs Eastern",
        TRUE                                           ~ cov),
      HRR = exp(mean), lo = exp(`2.5%`), hi = exp(`97.5%`)
    ) %>%
    select(Covariate, Drug, HRR, lo, hi)
}

beta_df <- imap_dfr(fits, ~ extract_beta(.x, .y)) %>%
  mutate(sig    = lo > 1 | hi < 1,
         sparse = Drug %in% c("Glinide", "INS") | hi / lo > 8,   # 單一研究、先驗主導
         group  = case_when(sig ~ "CrI excludes 1",
                            sparse ~ "Sparse / prior-driven",
                            TRUE ~ "Other"),
         label  = sprintf("%.3f [%.3f, %.3f]%s", HRR, lo, hi, if_else(sig, " *", "")))

tau_df <- imap_dfr(fits, ~ as.data.frame(summary(.x)) %>%
                     filter(parameter == "tau") %>%
                     transmute(Covariate = .y,
                               `tau (95% CrI)` = sprintf("%.3f [%.3f, %.3f]", mean, `2.5%`, `97.5%`)))

# ---------- 2. 合併表（藥物 × 共變項）----------
drug_order <- c("SGLT2i","GLP1RA","TZD","DPP4i","MET","Glinide","SU","AGI","INS")
cov_order  <- c("Sex","Age","Follow-up","Region: Western vs Eastern",
                "ROBINS-I: Moderate vs Low","ROBINS-I: Serious vs Low")

tab_wide <- beta_df %>%
  select(Drug, Covariate, label) %>%
  pivot_wider(names_from = Covariate, values_from = label) %>%
  mutate(Drug = factor(Drug, drug_order)) %>% arrange(Drug) %>%
  select(Drug, any_of(cov_order)) %>%
  mutate(across(-Drug, ~ replace_na(.x, "NA")))


#=== Sensitivity analysis ========================= ##


## Coefficient
net_sens_coefflow <- set_agd_contrast(
  data = dm,
  study = studylab,
  trt = treat, 
  y = logTE,
  se = `selogTE0.25`)

net_sens_coeffhigh <- set_agd_contrast(
  data = dm,
  study = studylab,
  trt = treat, 
  y = logTE,
  se = `selogTE0.75`)



sens_coefflow <- nma(
  net_sens_coefflow,
  consistency = "consistency",
  trt_effects = "random",   # 設定為隨機效應模型 (若要固定效應可改為 "fixed")
  likelihood = "normal",    # 對數風險比 (logHR) 服從常態分佈
  link = "identity",        # 因為已經是 log 尺度，所以不需要額外的轉換
  
  # 設定先驗分佈 (Priors)：提供弱資訊先驗以幫助 Stan 模型順利收斂
  prior_trt = mcmcset$prior_trt,
  prior_het = mcmcset$prior_het, # 異質性標準差(tau)的先驗
  
  # Stan 抽樣設定 (視你的電腦效能與收斂情況可調整)
  iter = mcmcset$iter,
  warmup = mcmcset$warmup,
  chains = mcmcset$chains,
)


sens_coeffhigh <- nma(
  net_sens_coeffhigh,
  consistency = "consistency",
  trt_effects = "random",   # 設定為隨機效應模型 (若要固定效應可改為 "fixed")
  likelihood = "normal",    # 對數風險比 (logHR) 服從常態分佈
  link = "identity",        # 因為已經是 log 尺度，所以不需要額外的轉換
  
  # 設定先驗分佈 (Priors)：提供弱資訊先驗以幫助 Stan 模型順利收斂
  prior_trt = mcmcset$prior_trt,
  prior_het = mcmcset$prior_het, # 異質性標準差(tau)的先驗
  
  # Stan 抽樣設定 (視你的電腦效能與收斂情況可調整)
  iter = mcmcset$iter,
  warmup = mcmcset$warmup,
  chains = mcmcset$chains
)


coeff_low <- as.data.frame(
  relative_effects(sens_coefflow, trt_ref = "SoC")
) %>%
  mutate(
    Treatment = .trtb,
    mean =exp(mean),
    `2.5%` =exp(`2.5%`),
    `97.5%` =exp(`97.5%`),
  ) %>%
  mutate(`rho=0.25` =  sprintf("%.2f [%.2f, %.2f]", mean, `2.5%`, `97.5%`)) %>%
  arrange(mean)%>%
  select(Treatment, `rho=0.25`)




coeff_high <- as.data.frame(
  relative_effects(sens_coeffhigh, trt_ref = "SoC")
) %>%
  mutate(
    Treatment = .trtb,
    mean =exp(mean),
    `2.5%` =exp(`2.5%`),
    `97.5%` =exp(`97.5%`),
  ) %>%
  mutate(`rho=0.75` =  sprintf("%.2f [%.2f, %.2f]", mean, `2.5%`, `97.5%`)) %>%
  arrange(mean)%>%
  select(Treatment, `rho=0.75`)

conb_sens_te <- left_join(coeff_low,coeff_high, by='Treatment') %>%
  inner_join(forest_data,by = 'Treatment') %>%
  rename(`rho=0.5`=`mean HR [95% CrI]`) %>%
  select(Treatment, `rho=0.25`, `rho=0.5`, `rho=0.75`)

## ROBINS
sens_rob_dm <- dm %>%
  filter( ROBINS!= "Serious")

net_sens_rob <- set_agd_contrast(
  data = sens_rob_dm,
  study = studylab,
  trt = treat, 
  y = logTE,
  se = `selogTE0.5`)

sens_rob <- nma(
  net_sens_rob,
  consistency = "consistency",
  trt_effects = "random",   # 設定為隨機效應模型 (若要固定效應可改為 "fixed")
  likelihood = "normal",    # 對數風險比 (logHR) 服從常態分佈
  link = "identity",        # 因為已經是 log 尺度，所以不需要額外的轉換
  
  # 設定先驗分佈 (Priors)：提供弱資訊先驗以幫助 Stan 模型順利收斂
  prior_trt = mcmcset$prior_trt,
  prior_het = mcmcset$prior_het, # 異質性標準差(tau)的先驗
  
  # Stan 抽樣設定 (視你的電腦效能與收斂情況可調整)
  iter = mcmcset$iter,
  warmup = mcmcset$warmup,
  chains = mcmcset$chains
)

rob_result <- as.data.frame(
  relative_effects(sens_rob, trt_ref = "SoC")
) %>%
  mutate(
    Treatment = .trtb,
    mean =exp(mean),
    `2.5%` =exp(`2.5%`),
    `97.5%` =exp(`97.5%`),
  ) %>%
  mutate(`ROBINS-I without serious` =  sprintf("%.2f [%.2f, %.2f]", mean, `2.5%`, `97.5%`)) %>%
  arrange(mean)%>%
  select(Treatment, `ROBINS-I without serious`)


conb_sens_te <- left_join(conb_sens_te, rob_result, by='Treatment')


## DIC
sens_dic_dm <- dm %>%
  filter_out( studylab %in% c('Samaras K, 2020', 'Kuan YC, 2017'))

net_sens_dic <- set_agd_contrast(
  data = sens_dic_dm,
  study = studylab,
  trt = treat, 
  y = logTE,
  se = `selogTE0.5`)

sens_dic <- nma(
  net_sens_dic,
  consistency = "consistency",
  trt_effects = "random",   # 設定為隨機效應模型 (若要固定效應可改為 "fixed")
  likelihood = "normal",    # 對數風險比 (logHR) 服從常態分佈
  link = "identity",        # 因為已經是 log 尺度，所以不需要額外的轉換
  
  # 設定先驗分佈 (Priors)：提供弱資訊先驗以幫助 Stan 模型順利收斂
  prior_trt = mcmcset$prior_trt,
  prior_het = mcmcset$prior_het, # 異質性標準差(tau)的先驗
  
  # Stan 抽樣設定 (視你的電腦效能與收斂情況可調整)
  iter = mcmcset$iter,
  warmup = mcmcset$warmup,
  chains = mcmcset$chains
)

dic_result <- as.data.frame(
  relative_effects(sens_dic, trt_ref = "SoC")
) %>%
  mutate(
    Treatment = .trtb,
    mean =exp(mean),
    `2.5%` =exp(`2.5%`),
    `97.5%` =exp(`97.5%`),
  ) %>%
  mutate(`DIC<3` =  sprintf("%.2f [%.2f, %.2f]", mean, `2.5%`, `97.5%`)) %>%
  arrange(mean)%>%
  select(Treatment, `DIC<3`)

conb_sens_te <- left_join(conb_sens_te, dic_result, by='Treatment') 





###################################################
### 儲存多個圖
all_graph <- c(netgraph,prior_posterior ,forestplot, rankogram, sucra, rankplot, plot_list, ume_plot, dicplot)


#網絡圖
ggsave("I:/我的雲端硬碟/糖尿病&神經退化疾病/Result/all cause dementia_ITT/network_graph_dementia.png", 
       plot=netgraph, width = 6, height = 6, units = "cm", dpi = 600, scale=2.2)

write.csv(fit_redata, "I:/我的雲端硬碟/糖尿病&神經退化疾病/Result/all cause dementia_ITT/nmadata_dementia.csv", row.names = FALSE)

#森林圖
ggsave("I:/我的雲端硬碟/糖尿病&神經退化疾病/Result/all cause dementia_ITT/forestplot_dementia.png", 
       plot=forestplot, width = 7, height = 5, bg = "white",
       units = "cm", dpi = 600, scale=2)

write.csv(forest_data, "I:/我的雲端硬碟/糖尿病&神經退化疾病/Result/all cause dementia_ITT/forestdata_dementia.csv", row.names = FALSE)
write.csv(forest, "I:/我的雲端硬碟/糖尿病&神經退化疾病/Result/all cause dementia_ITT/forestrawdata_dementia.csv", row.names = FALSE)

ggsave("I:/我的雲端硬碟/糖尿病&神經退化疾病/Result/all cause dementia_ITT/prior_posterior.png", 
       plot=prior_posterior, width = 8, height = 7, bg = "white",
       units = "cm", dpi = 600, scale=2)

#排名圖
ggsave("I:/我的雲端硬碟/糖尿病&神經退化疾病/Result/all cause dementia_ITT/rankplot_dementia.png", 
       plot=rankplot, width = 8, height = 11, units = "cm", dpi = 600, scale=2)

write.csv(sucra_data, "I:/我的雲端硬碟/糖尿病&神經退化疾病/Result/all cause dementia_ITT/sucradata_dementia.csv", row.names = FALSE)

#Node-splitting analysis
ggsave("I:/我的雲端硬碟/糖尿病&神經退化疾病/Result/all cause dementia_ITT/nodesplit1_dementia.png", 
       plot=plot_list[[1]], width = 8, height = 13, bg = "white",
       units = "cm", dpi = 600, scale=2)
ggsave("I:/我的雲端硬碟/糖尿病&神經退化疾病/Result/all cause dementia_ITT/nodesplit2_dementia.png", 
       plot=plot_list[[2]], width = 8, height = 13, bg = "white",
       units = "cm", dpi = 600, scale=2)
ggsave("I:/我的雲端硬碟/糖尿病&神經退化疾病/Result/all cause dementia_ITT/nodesplit3_dementia.png", 
       plot=plot_list[[3]], width = 9, height = 7, bg = "white",
       units = "cm", dpi = 600, scale=2)

write.csv(incons_tbl, "I:/我的雲端硬碟/糖尿病&神經退化疾病/Result/all cause dementia_ITT/incons_tbl.csv", row.names = FALSE)

#全域不一致測驗
ggsave("I:/我的雲端硬碟/糖尿病&神經退化疾病/Result/all cause dementia_ITT/ume_dementia.png", 
       plot=ume_plot, width = 6, height = 6, units = "cm", dpi = 600, scale=2.2)

#League table
write.csv(league_df, "I:/我的雲端硬碟/糖尿病&神經退化疾病/Result/all cause dementia_ITT/league_table_dementia.csv", row.names = FALSE)

#離差-槓桿圖
ggsave("I:/我的雲端硬碟/糖尿病&神經退化疾病/Result/all cause dementia_ITT/dicplot_dementia.png", 
       plot=dicplot, width = 7, height = 6, units = "cm", dpi = 600, scale=2.5)


#Transitivity 檢查
write.csv(trans_node,  "I:/我的雲端硬碟/糖尿病&神經退化疾病/Result/all cause dementia_ITT/transitivity_node_dementia.csv", row.names = FALSE)
write.csv(trans_comp,  "I:/我的雲端硬碟/糖尿病&神經退化疾病/Result/all cause dementia_ITT/transitivity_comp_dementia.csv", row.names = FALSE)
write.csv(trans_tests, "I:/我的雲端硬碟/糖尿病&神經退化疾病/Result/all cause dementia_ITT/transitivity_test_dementia.csv", row.names = FALSE)


#Meta-regression
write.csv(tab_wide, "I:/我的雲端硬碟/糖尿病&神經退化疾病/Result/all cause dementia_ITT/reg_dementia.csv", row.names = FALSE)

#sensitivity analysis
write.csv(conb_sens_te, "I:/我的雲端硬碟/糖尿病&神經退化疾病/Result/all cause dementia_ITT/sens_dementia.csv", row.names = FALSE)


save(list = ls(), file = "I:/我的雲端硬碟/糖尿病&神經退化疾病/Result/all cause dementia_ITT/202601004.Rdata")




