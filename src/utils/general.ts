export function formatNumber(num: number | string, decimalPlaces: number = 2): string {
  const factor = Math.pow(10, decimalPlaces)

  if (typeof num === 'string') {
    num = parseFloat(num)
  }

  const fixedNumber = Math.floor(num * factor) / factor
  return fixedNumber.toFixed(decimalPlaces)
}

export function formatNum(num: number | string, decimalPlaces: number = 2): string {
  const factor = Math.pow(10, decimalPlaces)
  if (typeof num === 'string') {
    num = parseFloat(num)
  }

  const fixedNumber = Math.floor(num * factor) / factor
  return fixedNumber.toLocaleString('en-US', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  })
}
