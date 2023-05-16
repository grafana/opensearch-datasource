package client

import (
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	. "github.com/smartystreets/goconvey/convey"
)

func TestIndexPattern(t *testing.T) {
	Convey("Static index patterns", t, func() {
		indexPatternScenario(noInterval, "data-*", nil, func(indices []string) {
			So(indices, ShouldHaveLength, 1)
			So(indices[0], ShouldEqual, "data-*")
		})

		indexPatternScenario(noInterval, "es-index-name", nil, func(indices []string) {
			So(indices, ShouldHaveLength, 1)
			So(indices[0], ShouldEqual, "es-index-name")
		})
	})

	Convey("Dynamic index patterns", t, func() {
		from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
		to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
		timeRange := &backend.TimeRange{From: from, To: to}

		indexPatternScenario(intervalHourly, "[data-]YYYY.MM.DD.HH", timeRange, func(indices []string) {
			So(indices, ShouldHaveLength, 1)
			So(indices[0], ShouldEqual, "data-2018.05.15.17")
		})

		indexPatternScenario(intervalHourly, "YYYY.MM.DD.HH[-data]", timeRange, func(indices []string) {
			So(indices, ShouldHaveLength, 1)
			So(indices[0], ShouldEqual, "2018.05.15.17-data")
		})

		indexPatternScenario(intervalDaily, "[data-]YYYY.MM.DD", timeRange, func(indices []string) {
			So(indices, ShouldHaveLength, 1)
			So(indices[0], ShouldEqual, "data-2018.05.15")
		})

		indexPatternScenario(intervalDaily, "YYYY.MM.DD[-data]", timeRange, func(indices []string) {
			So(indices, ShouldHaveLength, 1)
			So(indices[0], ShouldEqual, "2018.05.15-data")
		})

		indexPatternScenario(intervalWeekly, "[data-]GGGG.WW", timeRange, func(indices []string) {
			So(indices, ShouldHaveLength, 1)
			So(indices[0], ShouldEqual, "data-2018.20")
		})

		indexPatternScenario(intervalWeekly, "GGGG.WW[-data]", timeRange, func(indices []string) {
			So(indices, ShouldHaveLength, 1)
			So(indices[0], ShouldEqual, "2018.20-data")
		})

		indexPatternScenario(intervalMonthly, "[data-]YYYY.MM", timeRange, func(indices []string) {
			So(indices, ShouldHaveLength, 1)
			So(indices[0], ShouldEqual, "data-2018.05")
		})

		indexPatternScenario(intervalMonthly, "YYYY.MM[-data]", timeRange, func(indices []string) {
			So(indices, ShouldHaveLength, 1)
			So(indices[0], ShouldEqual, "2018.05-data")
		})

		indexPatternScenario(intervalYearly, "[data-]YYYY", timeRange, func(indices []string) {
			So(indices, ShouldHaveLength, 1)
			So(indices[0], ShouldEqual, "data-2018")
		})

		indexPatternScenario(intervalYearly, "YYYY[-data]", timeRange, func(indices []string) {
			So(indices, ShouldHaveLength, 1)
			So(indices[0], ShouldEqual, "2018-data")
		})

		indexPatternScenario(intervalDaily, "YYYY[-data-]MM.DD", timeRange, func(indices []string) {
			So(indices, ShouldHaveLength, 1)
			So(indices[0], ShouldEqual, "2018-data-05.15")
		})

		indexPatternScenario(intervalDaily, "[data-]YYYY[-moredata-]MM.DD", timeRange, func(indices []string) {
			So(indices, ShouldHaveLength, 1)
			So(indices[0], ShouldEqual, "data-2018-moredata-05.15")
		})

		Convey("Should return 01 week", func() {
			from = time.Date(2018, 1, 15, 17, 50, 0, 0, time.UTC)
			to = time.Date(2018, 1, 15, 17, 55, 0, 0, time.UTC)
			timeRange := &backend.TimeRange{From: from, To: to}
			indexPatternScenario(intervalWeekly, "[data-]GGGG.WW", timeRange, func(indices []string) {
				So(indices, ShouldHaveLength, 1)
				So(indices[0], ShouldEqual, "data-2018.03")
			})
		})
	})

	Convey("Hourly interval", t, func() {
		Convey("Should return 1 interval", func() {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 1, 23, 6, 0, 0, time.UTC)
			intervals := (&hourlyInterval{}).Generate(from, to)
			So(intervals, ShouldHaveLength, 1)
			So(intervals[0], ShouldEqual, time.Date(2018, 1, 1, 23, 0, 0, 0, time.UTC))
		})

		Convey("Should return 2 intervals", func() {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 2, 0, 6, 0, 0, time.UTC)
			intervals := (&hourlyInterval{}).Generate(from, to)
			So(intervals, ShouldHaveLength, 2)
			So(intervals[0], ShouldEqual, time.Date(2018, 1, 1, 23, 0, 0, 0, time.UTC))
			So(intervals[1], ShouldEqual, time.Date(2018, 1, 2, 0, 0, 0, 0, time.UTC))
		})

		Convey("Should return 10 intervals", func() {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 2, 8, 6, 0, 0, time.UTC)
			intervals := (&hourlyInterval{}).Generate(from, to)
			So(intervals, ShouldHaveLength, 10)
			So(intervals[0], ShouldEqual, time.Date(2018, 1, 1, 23, 0, 0, 0, time.UTC))
			So(intervals[4], ShouldEqual, time.Date(2018, 1, 2, 3, 0, 0, 0, time.UTC))
			So(intervals[9], ShouldEqual, time.Date(2018, 1, 2, 8, 0, 0, 0, time.UTC))
		})
	})

	Convey("Daily interval", t, func() {
		Convey("Should return 1 day", func() {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 1, 23, 6, 0, 0, time.UTC)
			intervals := (&dailyInterval{}).Generate(from, to)
			So(intervals, ShouldHaveLength, 1)
			So(intervals[0], ShouldEqual, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC))
		})

		Convey("Should return 2 days", func() {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 2, 0, 6, 0, 0, time.UTC)
			intervals := (&dailyInterval{}).Generate(from, to)
			So(intervals, ShouldHaveLength, 2)
			So(intervals[0], ShouldEqual, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC))
			So(intervals[1], ShouldEqual, time.Date(2018, 1, 2, 0, 0, 0, 0, time.UTC))
		})

		Convey("Should return 32 days", func() {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 2, 1, 8, 6, 0, 0, time.UTC)
			intervals := (&dailyInterval{}).Generate(from, to)
			So(intervals, ShouldHaveLength, 32)
			So(intervals[0], ShouldEqual, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC))
			So(intervals[30], ShouldEqual, time.Date(2018, 1, 31, 0, 0, 0, 0, time.UTC))
			So(intervals[31], ShouldEqual, time.Date(2018, 2, 1, 0, 0, 0, 0, time.UTC))
		})
	})

	Convey("Weekly interval", t, func() {
		Convey("Should return 1 week (1)", func() {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 1, 23, 6, 0, 0, time.UTC)
			intervals := (&weeklyInterval{}).Generate(from, to)
			So(intervals, ShouldHaveLength, 1)
			So(intervals[0], ShouldEqual, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC))
		})

		Convey("Should return 1 week (2)", func() {
			from := time.Date(2017, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2017, 1, 1, 23, 6, 0, 0, time.UTC)
			intervals := (&weeklyInterval{}).Generate(from, to)
			So(intervals, ShouldHaveLength, 1)
			So(intervals[0], ShouldEqual, time.Date(2016, 12, 26, 0, 0, 0, 0, time.UTC))
		})

		Convey("Should return 2 weeks (1)", func() {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 10, 23, 6, 0, 0, time.UTC)
			intervals := (&weeklyInterval{}).Generate(from, to)
			So(intervals, ShouldHaveLength, 2)
			So(intervals[0], ShouldEqual, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC))
			So(intervals[1], ShouldEqual, time.Date(2018, 1, 8, 0, 0, 0, 0, time.UTC))
		})

		Convey("Should return 2 weeks (2)", func() {
			from := time.Date(2017, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2017, 1, 8, 23, 6, 0, 0, time.UTC)
			intervals := (&weeklyInterval{}).Generate(from, to)
			So(intervals, ShouldHaveLength, 2)
			So(intervals[0], ShouldEqual, time.Date(2016, 12, 26, 0, 0, 0, 0, time.UTC))
			So(intervals[1], ShouldEqual, time.Date(2017, 1, 2, 0, 0, 0, 0, time.UTC))
		})

		Convey("Should return 3 weeks (1)", func() {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 21, 23, 6, 0, 0, time.UTC)
			intervals := (&weeklyInterval{}).Generate(from, to)
			So(intervals, ShouldHaveLength, 3)
			So(intervals[0], ShouldEqual, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC))
			So(intervals[1], ShouldEqual, time.Date(2018, 1, 8, 0, 0, 0, 0, time.UTC))
			So(intervals[2], ShouldEqual, time.Date(2018, 1, 15, 0, 0, 0, 0, time.UTC))
		})

		Convey("Should return 3 weeks (2)", func() {
			from := time.Date(2017, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2017, 1, 9, 23, 6, 0, 0, time.UTC)
			intervals := (&weeklyInterval{}).Generate(from, to)
			So(intervals, ShouldHaveLength, 3)
			So(intervals[0], ShouldEqual, time.Date(2016, 12, 26, 0, 0, 0, 0, time.UTC))
			So(intervals[1], ShouldEqual, time.Date(2017, 1, 2, 0, 0, 0, 0, time.UTC))
			So(intervals[2], ShouldEqual, time.Date(2017, 1, 9, 0, 0, 0, 0, time.UTC))
		})
	})

	Convey("Monthly interval", t, func() {
		Convey("Should return 1 month", func() {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 1, 23, 6, 0, 0, time.UTC)
			intervals := (&monthlyInterval{}).Generate(from, to)
			So(intervals, ShouldHaveLength, 1)
			So(intervals[0], ShouldEqual, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC))
		})

		Convey("Should return 2 months", func() {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 2, 2, 0, 6, 0, 0, time.UTC)
			intervals := (&monthlyInterval{}).Generate(from, to)
			So(intervals, ShouldHaveLength, 2)
			So(intervals[0], ShouldEqual, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC))
			So(intervals[1], ShouldEqual, time.Date(2018, 2, 1, 0, 0, 0, 0, time.UTC))
		})

		Convey("Should return 14 months", func() {
			from := time.Date(2017, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 2, 1, 8, 6, 0, 0, time.UTC)
			intervals := (&monthlyInterval{}).Generate(from, to)
			So(intervals, ShouldHaveLength, 14)
			So(intervals[0], ShouldEqual, time.Date(2017, 1, 1, 0, 0, 0, 0, time.UTC))
			So(intervals[13], ShouldEqual, time.Date(2018, 2, 1, 0, 0, 0, 0, time.UTC))
		})
	})

	Convey("Yearly interval", t, func() {
		Convey("Should return 1 year (hour diff)", func() {
			from := time.Date(2018, 2, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 2, 1, 23, 6, 0, 0, time.UTC)
			intervals := (&yearlyInterval{}).Generate(from, to)
			So(intervals, ShouldHaveLength, 1)
			So(intervals[0], ShouldEqual, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC))
		})

		Convey("Should return 1 year (month diff)", func() {
			from := time.Date(2018, 2, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 12, 31, 23, 59, 59, 0, time.UTC)
			intervals := (&yearlyInterval{}).Generate(from, to)
			So(intervals, ShouldHaveLength, 1)
			So(intervals[0], ShouldEqual, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC))
		})

		Convey("Should return 2 years", func() {
			from := time.Date(2018, 2, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2019, 1, 1, 23, 59, 59, 0, time.UTC)
			intervals := (&yearlyInterval{}).Generate(from, to)
			So(intervals, ShouldHaveLength, 2)
			So(intervals[0], ShouldEqual, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC))
			So(intervals[1], ShouldEqual, time.Date(2019, 1, 1, 0, 0, 0, 0, time.UTC))
		})

		Convey("Should return 5 years", func() {
			from := time.Date(2014, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 11, 1, 23, 59, 59, 0, time.UTC)
			intervals := (&yearlyInterval{}).Generate(from, to)
			So(intervals, ShouldHaveLength, 5)
			So(intervals[0], ShouldEqual, time.Date(2014, 1, 1, 0, 0, 0, 0, time.UTC))
			So(intervals[4], ShouldEqual, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC))
		})
	})

	Convey("PPL static index patterns", t, func() {
		pplIndexScenario(noInterval, "data-*", func(indices string) {
			So(indices, ShouldEqual, "data-*")
		})

		pplIndexScenario(noInterval, "es-index-name", func(indices string) {
			So(indices, ShouldEqual, "es-index-name")
		})
	})

	Convey("PPL dynamic index patterns", t, func() {
		pplIndexScenario(intervalHourly, "[data-]YYYY.MM.DD.HH", func(indices string) {
			So(indices, ShouldEqual, "data-*")
		})

		pplIndexScenario(intervalHourly, "YYYY.MM.DD.HH[-data]", func(indices string) {
			So(indices, ShouldEqual, "*-data")
		})

		pplIndexScenario(intervalDaily, "[data-]YYYY.MM.DD", func(indices string) {
			So(indices, ShouldEqual, "data-*")
		})

		pplIndexScenario(intervalDaily, "YYYY.MM.DD[-data]", func(indices string) {
			So(indices, ShouldEqual, "*-data")
		})

		pplIndexScenario(intervalWeekly, "[data-]GGGG.WW", func(indices string) {
			So(indices, ShouldEqual, "data-*")
		})

		pplIndexScenario(intervalWeekly, "GGGG.WW[-data]", func(indices string) {
			So(indices, ShouldEqual, "*-data")
		})
	})
}

func indexPatternScenario(interval string, pattern string, timeRange *backend.TimeRange, fn func(indices []string)) {
	Convey(fmt.Sprintf("Index pattern (interval=%s, index=%s", interval, pattern), func() {
		ip, err := newIndexPattern(interval, pattern)
		So(err, ShouldBeNil)
		So(ip, ShouldNotBeNil)
		indices, err := ip.GetIndices(timeRange)
		So(err, ShouldBeNil)
		fn(indices)
	})
}

func pplIndexScenario(interval string, pattern string, fn func(index string)) {
	Convey(fmt.Sprintf("Index pattern (interval=%s, index=%s", interval, pattern), func() {
		ip, err := newIndexPattern(interval, pattern)
		So(err, ShouldBeNil)
		So(ip, ShouldNotBeNil)
		index, err := ip.GetPPLIndex()
		So(err, ShouldBeNil)
		fn(index)
	})
}
