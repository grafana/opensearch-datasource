package client

import (
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
)

func TestIndexPattern(t *testing.T) {
	t.Run("Static index patterns", func(t *testing.T) {
		var pattern string = "data-*"
		t.Run(fmt.Sprintf("Index pattern (interval=%s, index=%s", noInterval, pattern), func(t *testing.T) {
			ip, err := newIndexPattern(noInterval, pattern)
			assert.NoError(t, err)
			assert.NotNil(t, ip)
			indices, err := ip.GetIndices(nil)
			assert.NoError(t, err)
			func(indices []string) {
				assert.Len(t, indices, 1)
				assert.Equal(t, "data-*", indices[0])
			}(indices)
		})

		var pattern2 string = "es-index-name"
		t.Run(fmt.Sprintf("Index pattern (interval=%s, index=%s", noInterval, pattern2), func(t *testing.T) {
			ip, err := newIndexPattern(noInterval, pattern2)
			assert.NoError(t, err)
			assert.NotNil(t, ip)
			indices, err := ip.GetIndices(nil)
			assert.NoError(t, err)
			func(indices []string) {
				assert.Len(t, indices, 1)
				assert.Equal(t, "es-index-name", indices[0])
			}(indices)
		})
	})

	t.Run("Dynamic index patterns", func(t *testing.T) {
		from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
		to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
		timeRange := &backend.TimeRange{From: from, To: to}

		var pattern string = "[data-]YYYY.MM.DD.HH"
		t.Run(fmt.Sprintf("Index pattern (interval=%s, index=%s", intervalHourly, pattern), func(t *testing.T) {
			ip, err := newIndexPattern(intervalHourly, pattern)
			assert.NoError(t, err)
			assert.NotNil(t, ip)
			indices, err := ip.GetIndices(timeRange)
			assert.NoError(t, err)
			func(indices []string) {
				assert.Len(t, indices, 1)
				assert.Equal(t, "data-2018.05.15.17", indices[0])
			}(indices)
		})

		var pattern2 string = "YYYY.MM.DD.HH[-data]"
		t.Run(fmt.Sprintf("Index pattern (interval=%s, index=%s", intervalHourly, pattern2), func(t *testing.T) {
			ip, err := newIndexPattern(intervalHourly, pattern2)
			assert.NoError(t, err)
			assert.NotNil(t, ip)
			indices, err := ip.GetIndices(timeRange)
			assert.NoError(t, err)
			func(indices []string) {
				assert.Len(t, indices, 1)
				assert.Equal(t, "2018.05.15.17-data", indices[0])
			}(indices)
		})

		var pattern3 string = "[data-]YYYY.MM.DD"
		t.Run(fmt.Sprintf("Index pattern (interval=%s, index=%s", intervalDaily, pattern3), func(t *testing.T) {
			ip, err := newIndexPattern(intervalDaily, pattern3)
			assert.NoError(t, err)
			assert.NotNil(t, ip)
			indices, err := ip.GetIndices(timeRange)
			assert.NoError(t, err)
			func(indices []string) {
				assert.Len(t, indices, 1)
				assert.Equal(t, "data-2018.05.15", indices[0])
			}(indices)
		})

		var pattern4 string = "YYYY.MM.DD[-data]"
		t.Run(fmt.Sprintf("Index pattern (interval=%s, index=%s", intervalDaily, pattern4), func(t *testing.T) {
			ip, err := newIndexPattern(intervalDaily, pattern4)
			assert.NoError(t, err)
			assert.NotNil(t, ip)
			indices, err := ip.GetIndices(timeRange)
			assert.NoError(t, err)
			func(indices []string) {
				assert.Len(t, indices, 1)
				assert.Equal(t, "2018.05.15-data", indices[0])
			}(indices)
		})

		var pattern5 string = "[data-]GGGG.WW"
		t.Run(fmt.Sprintf("Index pattern (interval=%s, index=%s", intervalWeekly, pattern5), func(t *testing.T) {
			ip, err := newIndexPattern(intervalWeekly, pattern5)
			assert.NoError(t, err)
			assert.NotNil(t, ip)
			indices, err := ip.GetIndices(timeRange)
			assert.NoError(t, err)
			func(indices []string) {
				assert.Len(t, indices, 1)
				assert.Equal(t, "data-2018.20", indices[0])
			}(indices)
		})

		var pattern6 string = "GGGG.WW[-data]"
		t.Run(fmt.Sprintf("Index pattern (interval=%s, index=%s", intervalWeekly, pattern6), func(t *testing.T) {
			ip, err := newIndexPattern(intervalWeekly, pattern6)
			assert.NoError(t, err)
			assert.NotNil(t, ip)
			indices, err := ip.GetIndices(timeRange)
			assert.NoError(t, err)
			func(indices []string) {
				assert.Len(t, indices, 1)
				assert.Equal(t, "2018.20-data", indices[0])
			}(indices)
		})

		var pattern7 string = "[data-]YYYY.MM"
		t.Run(fmt.Sprintf("Index pattern (interval=%s, index=%s", intervalMonthly, pattern7), func(t *testing.T) {
			ip, err := newIndexPattern(intervalMonthly, pattern7)
			assert.NoError(t, err)
			assert.NotNil(t, ip)
			indices, err := ip.GetIndices(timeRange)
			assert.NoError(t, err)
			func(indices []string) {
				assert.Len(t, indices, 1)
				assert.Equal(t, "data-2018.05", indices[0])
			}(indices)
		})

		var pattern8 string = "YYYY.MM[-data]"
		t.Run(fmt.Sprintf("Index pattern (interval=%s, index=%s", intervalMonthly, pattern8), func(t *testing.T) {
			ip, err := newIndexPattern(intervalMonthly, pattern8)
			assert.NoError(t, err)
			assert.NotNil(t, ip)
			indices, err := ip.GetIndices(timeRange)
			assert.NoError(t, err)
			func(indices []string) {
				assert.Len(t, indices, 1)
				assert.Equal(t, "2018.05-data", indices[0])
			}(indices)
		})

		var pattern9 string = "[data-]YYYY"
		t.Run(fmt.Sprintf("Index pattern (interval=%s, index=%s", intervalYearly, pattern9), func(t *testing.T) {
			ip, err := newIndexPattern(intervalYearly, pattern9)
			assert.NoError(t, err)
			assert.NotNil(t, ip)
			indices, err := ip.GetIndices(timeRange)
			assert.NoError(t, err)
			func(indices []string) {
				assert.Len(t, indices, 1)
				assert.Equal(t, "data-2018", indices[0])
			}(indices)
		})

		var pattern10 string = "YYYY[-data]"
		t.Run(fmt.Sprintf("Index pattern (interval=%s, index=%s", intervalYearly, pattern10), func(t *testing.T) {
			ip, err := newIndexPattern(intervalYearly, pattern10)
			assert.NoError(t, err)
			assert.NotNil(t, ip)
			indices, err := ip.GetIndices(timeRange)
			assert.NoError(t, err)
			func(indices []string) {
				assert.Len(t, indices, 1)
				assert.Equal(t, "2018-data", indices[0])
			}(indices)
		})

		var pattern11 string = "YYYY[-data-]MM.DD"
		t.Run(fmt.Sprintf("Index pattern (interval=%s, index=%s", intervalDaily, pattern11), func(t *testing.T) {
			ip, err := newIndexPattern(intervalDaily, pattern11)
			assert.NoError(t, err)
			assert.NotNil(t, ip)
			indices, err := ip.GetIndices(timeRange)
			assert.NoError(t, err)
			func(indices []string) {
				assert.Len(t, indices, 1)
				assert.Equal(t, "2018-data-05.15", indices[0])
			}(indices)
		})

		var pattern12 string = "[data-]YYYY[-moredata-]MM.DD"
		t.Run(fmt.Sprintf("Index pattern (interval=%s, index=%s", intervalDaily, pattern12), func(t *testing.T) {
			ip, err := newIndexPattern(intervalDaily, pattern12)
			assert.NoError(t, err)
			assert.NotNil(t, ip)
			indices, err := ip.GetIndices(timeRange)
			assert.NoError(t, err)
			func(indices []string) {
				assert.Len(t, indices, 1)
				assert.Equal(t, "data-2018-moredata-05.15", indices[0])
			}(indices)
		})

		t.Run("Should return 01 week", func(t *testing.T) {
			from = time.Date(2018, 1, 15, 17, 50, 0, 0, time.UTC)
			to = time.Date(2018, 1, 15, 17, 55, 0, 0, time.UTC)
			timeRange := &backend.TimeRange{From: from, To: to}
			var pattern13 string = "[data-]GGGG.WW"
			t.Run(fmt.Sprintf("Index pattern (interval=%s, index=%s", intervalWeekly, pattern13), func(t *testing.T) {
				ip, err := newIndexPattern(intervalWeekly, pattern13)
				assert.NoError(t, err)
				assert.NotNil(t, ip)
				indices, err := ip.GetIndices(timeRange)
				assert.NoError(t, err)
				func(indices []string) {
					assert.Len(t, indices, 1)
					assert.Equal(t, "data-2018.03", indices[0])
				}(indices)
			})
		})
	})

	t.Run("Hourly interval", func(t *testing.T) {
		t.Run("Should return 1 interval", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 1, 23, 6, 0, 0, time.UTC)
			intervals := (&hourlyInterval{}).Generate(from, to)
			assert.Len(t, intervals, 1)
			assert.Equal(t, time.Date(2018, 1, 1, 23, 0, 0, 0, time.UTC), intervals[0])
		})

		t.Run("Should return 2 intervals", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 2, 0, 6, 0, 0, time.UTC)
			intervals := (&hourlyInterval{}).Generate(from, to)
			assert.Len(t, intervals, 2)
			assert.Equal(t, time.Date(2018, 1, 1, 23, 0, 0, 0, time.UTC), intervals[0])
			assert.Equal(t, time.Date(2018, 1, 2, 0, 0, 0, 0, time.UTC), intervals[1])
		})

		t.Run("Should return 10 intervals", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 2, 8, 6, 0, 0, time.UTC)
			intervals := (&hourlyInterval{}).Generate(from, to)
			assert.Len(t, intervals, 10)
			assert.Equal(t, time.Date(2018, 1, 1, 23, 0, 0, 0, time.UTC), intervals[0])
			assert.Equal(t, time.Date(2018, 1, 2, 3, 0, 0, 0, time.UTC), intervals[4])
			assert.Equal(t, time.Date(2018, 1, 2, 8, 0, 0, 0, time.UTC), intervals[9])
		})
	})

	t.Run("Daily interval", func(t *testing.T) {
		t.Run("Should return 1 day", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 1, 23, 6, 0, 0, time.UTC)
			intervals := (&dailyInterval{}).Generate(from, to)
			assert.Len(t, intervals, 1)
			assert.Equal(t, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
		})

		t.Run("Should return 2 days", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 2, 0, 6, 0, 0, time.UTC)
			intervals := (&dailyInterval{}).Generate(from, to)
			assert.Len(t, intervals, 2)
			assert.Equal(t, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
			assert.Equal(t, time.Date(2018, 1, 2, 0, 0, 0, 0, time.UTC), intervals[1])
		})

		t.Run("Should return 32 days", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 2, 1, 8, 6, 0, 0, time.UTC)
			intervals := (&dailyInterval{}).Generate(from, to)
			assert.Len(t, intervals, 32)
			assert.Equal(t, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
			assert.Equal(t, time.Date(2018, 1, 31, 0, 0, 0, 0, time.UTC), intervals[30])
			assert.Equal(t, time.Date(2018, 2, 1, 0, 0, 0, 0, time.UTC), intervals[31])
		})
	})

	t.Run("Weekly interval", func(t *testing.T) {
		t.Run("Should return 1 week (1)", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 1, 23, 6, 0, 0, time.UTC)
			intervals := (&weeklyInterval{}).Generate(from, to)
			assert.Len(t, intervals, 1)
			assert.Equal(t, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
		})

		t.Run("Should return 1 week (2)", func(t *testing.T) {
			from := time.Date(2017, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2017, 1, 1, 23, 6, 0, 0, time.UTC)
			intervals := (&weeklyInterval{}).Generate(from, to)
			assert.Len(t, intervals, 1)
			assert.Equal(t, time.Date(2016, 12, 26, 0, 0, 0, 0, time.UTC), intervals[0])
		})

		t.Run("Should return 2 weeks (1)", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 10, 23, 6, 0, 0, time.UTC)
			intervals := (&weeklyInterval{}).Generate(from, to)
			assert.Len(t, intervals, 2)
			assert.Equal(t, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
			assert.Equal(t, time.Date(2018, 1, 8, 0, 0, 0, 0, time.UTC), intervals[1])
		})

		t.Run("Should return 2 weeks (2)", func(t *testing.T) {
			from := time.Date(2017, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2017, 1, 8, 23, 6, 0, 0, time.UTC)
			intervals := (&weeklyInterval{}).Generate(from, to)
			assert.Len(t, intervals, 2)
			assert.Equal(t, time.Date(2016, 12, 26, 0, 0, 0, 0, time.UTC), intervals[0])
			assert.Equal(t, time.Date(2017, 1, 2, 0, 0, 0, 0, time.UTC), intervals[1])
		})

		t.Run("Should return 3 weeks (1)", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 21, 23, 6, 0, 0, time.UTC)
			intervals := (&weeklyInterval{}).Generate(from, to)
			assert.Len(t, intervals, 3)
			assert.Equal(t, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
			assert.Equal(t, time.Date(2018, 1, 8, 0, 0, 0, 0, time.UTC), intervals[1])
			assert.Equal(t, time.Date(2018, 1, 15, 0, 0, 0, 0, time.UTC), intervals[2])
		})

		t.Run("Should return 3 weeks (2)", func(t *testing.T) {
			from := time.Date(2017, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2017, 1, 9, 23, 6, 0, 0, time.UTC)
			intervals := (&weeklyInterval{}).Generate(from, to)
			assert.Len(t, intervals, 3)
			assert.Equal(t, time.Date(2016, 12, 26, 0, 0, 0, 0, time.UTC), intervals[0])
			assert.Equal(t, time.Date(2017, 1, 2, 0, 0, 0, 0, time.UTC), intervals[1])
			assert.Equal(t, time.Date(2017, 1, 9, 0, 0, 0, 0, time.UTC), intervals[2])
		})
	})

	t.Run("Monthly interval", func(t *testing.T) {
		t.Run("Should return 1 month", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 1, 23, 6, 0, 0, time.UTC)
			intervals := (&monthlyInterval{}).Generate(from, to)
			assert.Len(t, intervals, 1)
			assert.Equal(t, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
		})

		t.Run("Should return 2 months", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 2, 2, 0, 6, 0, 0, time.UTC)
			intervals := (&monthlyInterval{}).Generate(from, to)
			assert.Len(t, intervals, 2)
			assert.Equal(t, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
			assert.Equal(t, time.Date(2018, 2, 1, 0, 0, 0, 0, time.UTC), intervals[1])
		})

		t.Run("Should return 14 months", func(t *testing.T) {
			from := time.Date(2017, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 2, 1, 8, 6, 0, 0, time.UTC)
			intervals := (&monthlyInterval{}).Generate(from, to)
			assert.Len(t, intervals, 14)
			assert.Equal(t, time.Date(2017, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
			assert.Equal(t, time.Date(2018, 2, 1, 0, 0, 0, 0, time.UTC), intervals[13])
		})
	})

	t.Run("Yearly interval", func(t *testing.T) {
		t.Run("Should return 1 year (hour diff)", func(t *testing.T) {
			from := time.Date(2018, 2, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 2, 1, 23, 6, 0, 0, time.UTC)
			intervals := (&yearlyInterval{}).Generate(from, to)
			assert.Len(t, intervals, 1)
			assert.Equal(t, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
		})

		t.Run("Should return 1 year (month diff)", func(t *testing.T) {
			from := time.Date(2018, 2, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 12, 31, 23, 59, 59, 0, time.UTC)
			intervals := (&yearlyInterval{}).Generate(from, to)
			assert.Len(t, intervals, 1)
			assert.Equal(t, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
		})

		t.Run("Should return 2 years", func(t *testing.T) {
			from := time.Date(2018, 2, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2019, 1, 1, 23, 59, 59, 0, time.UTC)
			intervals := (&yearlyInterval{}).Generate(from, to)
			assert.Len(t, intervals, 2)
			assert.Equal(t, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
			assert.Equal(t, time.Date(2019, 1, 1, 0, 0, 0, 0, time.UTC), intervals[1])
		})

		t.Run("Should return 5 years", func(t *testing.T) {
			from := time.Date(2014, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 11, 1, 23, 59, 59, 0, time.UTC)
			intervals := (&yearlyInterval{}).Generate(from, to)
			assert.Len(t, intervals, 5)
			assert.Equal(t, time.Date(2014, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
			assert.Equal(t, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), intervals[4])
		})
	})

	t.Run("PPL static index patterns", func(t *testing.T) {
		var pattern string = "data-*"
		t.Run(fmt.Sprintf("Index pattern (interval=%s, index=%s", noInterval, pattern), func(t *testing.T) {
			ip, err := newIndexPattern(noInterval, pattern)
			assert.NoError(t, err)
			assert.NotNil(t, ip)
			index, err := ip.GetPPLIndex()
			assert.NoError(t, err)
			func(indices string) {
				assert.Equal(t, "data-*", indices)
			}(index)
		})

		var pattern2 string = "es-index-name"
		t.Run(fmt.Sprintf("Index pattern (interval=%s, index=%s", noInterval, pattern2), func(t *testing.T) {
			ip, err := newIndexPattern(noInterval, pattern2)
			assert.NoError(t, err)
			assert.NotNil(t, ip)
			index, err := ip.GetPPLIndex()
			assert.NoError(t, err)
			func(indices string) {
				assert.Equal(t, "es-index-name", indices)
			}(index)
		})
	})

	t.Run("PPL dynamic index patterns", func(t *testing.T) {
		var pattern string = "[data-]YYYY.MM.DD.HH"
		t.Run(fmt.Sprintf("Index pattern (interval=%s, index=%s", intervalHourly, pattern), func(t *testing.T) {
			ip, err := newIndexPattern(intervalHourly, pattern)
			assert.NoError(t, err)
			assert.NotNil(t, ip)
			index, err := ip.GetPPLIndex()
			assert.NoError(t, err)
			func(indices string) {
				assert.Equal(t, "data-*", indices)
			}(index)
		})

		var pattern2 string = "YYYY.MM.DD.HH[-data]"
		t.Run(fmt.Sprintf("Index pattern (interval=%s, index=%s", intervalHourly, pattern2), func(t *testing.T) {
			ip, err := newIndexPattern(intervalHourly, pattern2)
			assert.NoError(t, err)
			assert.NotNil(t, ip)
			index, err := ip.GetPPLIndex()
			assert.NoError(t, err)
			func(indices string) {
				assert.Equal(t, "*-data", indices)
			}(index)
		})

		var pattern3 string = "[data-]YYYY.MM.DD"
		t.Run(fmt.Sprintf("Index pattern (interval=%s, index=%s", intervalDaily, pattern3), func(t *testing.T) {
			ip, err := newIndexPattern(intervalDaily, pattern3)
			assert.NoError(t, err)
			assert.NotNil(t, ip)
			index, err := ip.GetPPLIndex()
			assert.NoError(t, err)
			func(indices string) {
				assert.Equal(t, "data-*", indices)
			}(index)
		})

		var pattern4 string = "YYYY.MM.DD[-data]"
		t.Run(fmt.Sprintf("Index pattern (interval=%s, index=%s", intervalDaily, pattern4), func(t *testing.T) {
			ip, err := newIndexPattern(intervalDaily, pattern4)
			assert.NoError(t, err)
			assert.NotNil(t, ip)
			index, err := ip.GetPPLIndex()
			assert.NoError(t, err)
			func(indices string) {
				assert.Equal(t, "*-data", indices)
			}(index)
		})

		var pattern5 string = "[data-]GGGG.WW"
		t.Run(fmt.Sprintf("Index pattern (interval=%s, index=%s", intervalWeekly, pattern5), func(t *testing.T) {
			ip, err := newIndexPattern(intervalWeekly, pattern5)
			assert.NoError(t, err)
			assert.NotNil(t, ip)
			index, err := ip.GetPPLIndex()
			assert.NoError(t, err)
			func(indices string) {
				assert.Equal(t, "data-*", indices)
			}(index)
		})

		var pattern6 string = "GGGG.WW[-data]"
		t.Run(fmt.Sprintf("Index pattern (interval=%s, index=%s", intervalWeekly, pattern6), func(t *testing.T) {
			ip, err := newIndexPattern(intervalWeekly, pattern6)
			assert.NoError(t, err)
			assert.NotNil(t, ip)
			index, err := ip.GetPPLIndex()
			assert.NoError(t, err)
			func(indices string) {
				assert.Equal(t, "*-data", indices)
			}(index)
		})
	})
}
