export type Num1to30 = Num1To12 | 13 | 14 | 15 | 16 |
    17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 |
    25 | 26 | 27 | 28 | 29 | 30;

export type Num1To12 = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
    10 | 11 | 12;

export type remSizes = `${Num1to30}rem`; // → '1rem' | ... | '30rem'
export type emSizes = `${Num1to30}em`; // → '1em' | ... | '30em'
