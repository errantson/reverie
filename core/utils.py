#!/usr/bin/env python3
"""
Core utility functions for Reverie House
"""

def number_to_words(n: int) -> str:
    """
    Convert a number to its word representation (0-999)
    
    Examples:
        >>> number_to_words(1)
        'one'
        >>> number_to_words(21)
        'twenty one'
        >>> number_to_words(100)
        'one hundred'
    """
    if n == 0:
        return 'zero'
    
    ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
    teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 
             'sixteen', 'seventeen', 'eighteen', 'nineteen']
    tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
    
    if n < 10:
        return ones[n]
    elif n < 20:
        return teens[n - 10]
    elif n < 100:
        ten_digit = n // 10
        one_digit = n % 10
        if one_digit == 0:
            return tens[ten_digit]
        else:
            return f"{tens[ten_digit]} {ones[one_digit]}"
    elif n < 1000:
        hundred_digit = n // 100
        remainder = n % 100
        if remainder == 0:
            return f"{ones[hundred_digit]} hundred"
        else:
            return f"{ones[hundred_digit]} hundred {number_to_words(remainder)}"
    else:
        return str(n)  # For very large numbers, just use the number
