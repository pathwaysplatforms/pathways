/** CLB score clamped to 0–12. */
export type CLBScore = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

/** Work-years bucket clamped to 0–5. */
export type WorkBucket = 0 | 1 | 2 | 3 | 4 | 5

// All point values sourced from:
// https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html

export const AGE_POINTS = {
  withSpouse: {
    17: 0, 18: 90, 19: 95,
    20: 100, 21: 100, 22: 100, 23: 100, 24: 100,
    25: 100, 26: 100, 27: 100, 28: 100, 29: 100,
    30: 95, 31: 90, 32: 85, 33: 80, 34: 75, 35: 70,
    36: 65, 37: 60, 38: 55, 39: 50, 40: 45,
    41: 35, 42: 25, 43: 15, 44: 5, 45: 0,
  },
  withoutSpouse: {
    17: 0, 18: 99, 19: 105,
    20: 110, 21: 110, 22: 110, 23: 110, 24: 110,
    25: 110, 26: 110, 27: 110, 28: 110, 29: 110,
    30: 105, 31: 99, 32: 94, 33: 88, 34: 83, 35: 77,
    36: 72, 37: 66, 38: 61, 39: 55, 40: 50,
    41: 39, 42: 28, 43: 17, 44: 6, 45: 0,
  },
} as const

export const EDUCATION_POINTS = {
  withSpouse: {
    less_than_secondary: 0, secondary: 28,
    one_year_post_secondary: 84, two_year_post_secondary: 91,
    bachelors: 112, two_or_more_credentials: 119,
    masters: 126, phd: 140,
  },
  withoutSpouse: {
    less_than_secondary: 0, secondary: 30,
    one_year_post_secondary: 90, two_year_post_secondary: 98,
    bachelors: 120, two_or_more_credentials: 128,
    masters: 135, phd: 150,
  },
} as const

/** Points per ability (reading/writing/speaking/listening). Sum all four for section total. */
export const FIRST_LANG_POINTS_PER_ABILITY = {
  withSpouse:    { 0:0,1:0,2:0,3:0,4:6,5:6,6:8,7:16,8:22,9:29,10:32,11:32,12:32 },
  withoutSpouse: { 0:0,1:0,2:0,3:0,4:6,5:6,6:9,7:17,8:23,9:31,10:34,11:34,12:34 },
} as const

/** Points per ability for second official language. Sum all four then apply cap. */
export const SECOND_LANG_POINTS_PER_ABILITY = {
  withSpouse:    { 0:0,1:0,2:0,3:0,4:0,5:1,6:1,7:3,8:3,9:6,10:6,11:6,12:6 },
  withoutSpouse: { 0:0,1:0,2:0,3:0,4:0,5:1,6:1,7:3,8:3,9:6,10:6,11:6,12:6 },
} as const

export const SECOND_LANG_CAP = { withSpouse: 22, withoutSpouse: 24 } as const

export const CANADIAN_WORK_POINTS = {
  withSpouse:    { 0:0, 1:35, 2:46, 3:56, 4:63, 5:70 },
  withoutSpouse: { 0:0, 1:40, 2:53, 3:64, 4:72, 5:80 },
} as const

export const SPOUSE_EDUCATION_POINTS = {
  less_than_secondary: 0, secondary: 2,
  one_year_post_secondary: 6, two_year_post_secondary: 7,
  bachelors: 8, two_or_more_credentials: 9,
  masters: 10, phd: 10,
} as const

/** Points per ability for spouse first language. Sum all four, cap at 20. */
export const SPOUSE_LANG_POINTS_PER_ABILITY = {
  0:0,1:0,2:0,3:0,4:0,5:1,6:1,7:3,8:3,9:5,10:5,11:5,12:5,
} as const

export const SPOUSE_WORK_POINTS = {
  0:0, 1:5, 2:7, 3:8, 4:9, 5:10,
} as const
