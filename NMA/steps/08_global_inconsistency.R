#===================================================================#
# Step 8. 全域不一致性（UME 模型）與離差-槓桿圖
#   需要：net、fit_re
#   產出：fit_ume、dic_cons、dic_ume
#         ume_plot → ume_<tag>.png
#         dicplot  → dicplot_<tag>.png
#===================================================================#

fit_ume <- run_nma("ume", net, consistency = "ume")

# 比較兩個模型的 DIC
dic_cons  <- dic(fit_re)
dic_ume   <- dic(fit_ume)
delta_dic <- dic_cons$dic - dic_ume$dic
label_text <- sprintf("Consistency model DIC: %.2f | UME model DIC: %.2f\nΔ DIC: %.2f",
                      dic_cons$dic, dic_ume$dic, delta_dic)
print(dic_cons)
print(dic_ume)

# Deviance-Deviance plot：看出是哪個研究 / 哪一臂造成不一致
ume_plot <- plot(dic_cons, dic_ume, point_alpha = 0.7, interval_alpha = 0.15,
                 color = "#000080") +
  labs(x       = "Residual deviance from consistency model",
       y       = "Residual deviance from unrelated mean effects model (UME)",
       title   = sprintf("Global Inconsistency Analysis (%s)", cfg$title),
       caption = label_text) +
  theme_bw() +
  theme(plot.title   = element_text(hjust = 0.5, face = "bold"),
        plot.caption = element_text(hjust = 0.5, face = "bold",
                                    color = "gray30", lineheight = 1.2))

ume_plot
save_plot(ume_plot, "ume", width = 6, height = 6, scale = 2.2)


# 離差-槓桿圖：DIC ≥ 2 的點加上研究名稱
dicplot_nolabel <- plot(dic_cons, type = "leverage", dic_contours = 1:4)

dicplot_nolabel$data <- dicplot_nolabel$data %>%
  mutate(`DIC level` = case_when(
    ssrd^2 + leverage >= 3 ~ "DIC>=3",
    ssrd^2 + leverage >= 2 ~ "3>DIC>=2",
    TRUE                   ~ "DIC<2"
  ))

dicplot <- dicplot_nolabel +
  aes(colour = `DIC level`) +
  scale_colour_manual(values = c("DIC>=3" = "red", "3>DIC>=2" = "blue", "DIC<2" = "black")) +
  geom_text_repel(
    data = subset(dicplot_nolabel$data, `DIC level` %in% c("DIC>=3", "3>DIC>=2")),
    aes(x = ssrd, y = leverage, label = .label),
    fontface = "bold", size = 2.5,
    box.padding        = 0.8,      # 標籤周圍的保護區
    point.padding      = 0.25,     # 標籤與點的最小距離
    force              = 1.5,      # 排斥力
    nudge_x            = -0.1,
    segment.color      = "grey30", # 引導線
    segment.size       = 0.3,
    min.segment.length = 0,        # 一律畫引導線
    max.overlaps       = Inf       # 顯示所有標籤
  ) +
  labs(title = sprintf("Deviance-Leverage plot (%s)", cfg$title)) +
  theme_bw() +
  theme(legend.title    = element_blank(),
        legend.position = "bottom",
        plot.title      = element_text(hjust = 0.5, face = "bold"))

# 列出 DIC ≥ 3 的研究，可考慮放進 config 的敏感度分析 drop_studies
print(dicplot_nolabel$data %>% filter(`DIC level` == "DIC>=3") %>% select(.label, ssrd, leverage))

dicplot
save_plot(dicplot, "dicplot", width = 7, height = 6, scale = 2.5)
