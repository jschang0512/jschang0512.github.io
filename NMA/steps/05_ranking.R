#===================================================================#
# Step 5. 排名與 SUCRA
#   需要：fit_re
#   產出：rank_mod、sucra_data → sucradata_<tag>.csv
#         rankogram、sucra、rankplot → rankplot_<tag>.png
#===================================================================#

ranks <- posterior_ranks(fit_re, lower_better = cfg$lower_better)

rank_mod <- as.data.frame(ranks) %>%
  transmute(parameter = strip_param(parameter), mean, `2.5%`, `50%`, `97.5%`) %>%
  arrange(`50%`)
print(rank_mod)

plot(ranks) + labs(title = "Rank")

# 累積排名機率與 SUCRA
rankprob_cum <- as.data.frame(
  posterior_rank_probs(fit_re, lower_better = cfg$lower_better,
                       cumulative = TRUE, sucra = TRUE)
)

rankprob_plot <- rankprob_cum %>%
  select(-.trt) %>%
  mutate(parameter = strip_param(parameter)) %>%
  pivot_longer(cols = starts_with("p_rank"),
               names_to = "Rank", values_to = "Cumulative_Probability") %>%
  mutate(Rank = as.numeric(gsub("p_rank\\[([0-9]+)\\]", "\\1", Rank)))

n_trt <- n_distinct(rankprob_plot$parameter)

# Rankogram
rankogram <- ggplot(rankprob_plot,
                    aes(x = Rank, y = Cumulative_Probability, color = parameter)) +
  geom_line(linewidth = 1.2) +
  geom_point(size = 4) +
  scale_color_igv() +
  scale_y_continuous(labels = percent_format(), limits = c(0, 1)) +
  scale_x_continuous(breaks = 1:n_trt) +
  labs(x = "Rank", y = "Cumulative Probability") +
  guides(color = guide_legend(ncol = 5)) +
  theme_classic() +
  theme(legend.position = "bottom",
        legend.title    = element_blank(),
        axis.title      = element_text(face = "bold"))

# SUCRA 長條圖
sucra_data <- rankprob_cum %>%
  transmute(parameter = strip_param(parameter), sucra = sucra * 100)

sucra <- ggplot(sucra_data, aes(x = reorder(parameter, -sucra), y = sucra)) +
  geom_col(fill = "gray20") +
  geom_text(aes(label = round(sucra, 2)),
            vjust = 1.2, color = "white", fontface = "bold") +
  labs(x = "Medication", y = "SUCRA (%)") +
  theme_minimal() +
  theme(axis.text  = element_text(size = 9, color = "black"),
        axis.title = element_text(face = "bold"))

rankplot <- rankogram / sucra +
  plot_annotation(title = sprintf("Medication ranking for %s", cfg$title),
                  tag_levels = "A") +
  plot_layout(heights = c(3, 1)) &
  theme(plot.title = element_text(hjust = 0.5, face = "bold"))

rankplot
save_plot(rankplot, "rankplot", width = 8, height = 11)
save_table(sucra_data, "sucradata")
