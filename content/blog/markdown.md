---
title: R Markdown Syntax Guide
date: 2020-01-01

---

We build a linear regression below.


```r
fit = lm(dist ~ speed, data = cars)
b = coef(summary(fit))
plot(fit)
```

<img src="/blog/markdown_files/figure-html/unnamed-chunk-1-1.png" width="672" /><img src="/blog/markdown_files/figure-html/unnamed-chunk-1-2.png" width="672" /><img src="/blog/markdown_files/figure-html/unnamed-chunk-1-3.png" width="672" /><img src="/blog/markdown_files/figure-html/unnamed-chunk-1-4.png" width="672" />

The slope of the regression is 3.9324088.
