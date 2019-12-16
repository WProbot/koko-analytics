'use strict'

import React from 'react'
import PropTypes from 'prop-types'
import { format } from 'date-fns'
import api from '../util/api.js'
import '../../sass/chart.scss'
import numbers from '../util/numbers'

const i18n = window.koko_analytics.i18n

function step (v, ticks) {
  let step = (v - (v % ticks)) / ticks
  if (step === 0) {
    return 0
  }

  let round = 1000000
  while (v < round * ticks) {
    round /= 10
  }
  step = Math.floor(step / round) * round
  return step
}

export default class Component extends React.PureComponent {
  constructor (props) {
    super(props)

    this.state = {
      dataset: [],
      yMax: 0
    }

    this.base = React.createRef()
    this.tooltip = document.createElement('div')
    this.showTooltip = this.showTooltip.bind(this)
    this.hideTooltip = this.hideTooltip.bind(this)
  }

  componentDidMount () {
    this.updateChart()

    this.tooltip.className = 'tooltip'
    this.tooltip.style.display = 'none'
    document.body.appendChild(this.tooltip)
    document.addEventListener('click', this.hideTooltip)
  }

  componentWillUnmount () {
    document.removeEventListener('click', this.hideTooltip)
  }

  componentDidUpdate (prevProps, prevState, snapshot) {
    if (this.props.startDate.getTime() === prevProps.startDate.getTime() && this.props.endDate.getTime() === prevProps.endDate.getTime()) {
      return
    }

    this.updateChart()
  }

  updateChart () {
    // empty previous data
    const dataset = {}
    let yMax = 0
    this.tooltip.style.display = 'none'

    // fill chart with 0's
    for (let d = new Date(this.props.startDate); d <= this.props.endDate; d.setDate(d.getDate() + 1)) {
      const key = format(d, 'yyyy-MM-dd')
      dataset[key] = {
        date: new Date(d),
        pageviews: 0,
        visitors: 0
      }
    }
    this.setState({
      dataset: Object.values(dataset)
    })

    // fetch actual stats
    api.request('/stats', {
      body: {
        start_date: format(this.props.startDate, 'yyyy-MM-dd'),
        end_date: format(this.props.endDate, 'yyyy-MM-dd')
      }
    }).then(data => {
      data.forEach(d => {
        if (typeof (dataset[d.date]) === 'undefined') {
          console.error('Unexpected date in response data', d.date)
          return
        }

        const pageviews = parseInt(d.pageviews)
        const visitors = parseInt(d.visitors)
        dataset[d.date].pageviews = pageviews
        dataset[d.date].visitors = visitors

        if (pageviews > yMax) {
          yMax = pageviews
        }
      })

      this.setState({
        dataset: Object.values(dataset),
        yMax
      })
    })
  }

  showTooltip (data, barWidth) {
    const el = this.tooltip

    return (evt) => {
      const bar = evt.currentTarget
      const styles = bar.getBoundingClientRect()

      el.innerHTML = `
      <div class="tooltip-inner">
        <div class="heading">${format(data.date, 'MMM d, yyyy')}</div>
        <div class="content">
          <div class="visitors">
            <div class="amount">${data.visitors}</div>
            <div>${i18n.Visitors}</div>
          </div>
          <div class="pageviews">
            <div class="amount">${data.pageviews}</div>
            <div>${i18n.Pageviews}</div>
          </div>
        </div>
      </div>
      <div class="tooltip-arrow"></div>`
      el.style.display = 'block'
      el.style.left = (styles.left + window.scrollX - 0.5 * el.clientWidth + 0.5 * barWidth) + 'px'
      el.style.top = (styles.y + window.scrollY - el.clientHeight) + 'px'
    }
  }

  hideTooltip (evt) {
    if (evt.type === 'click' && typeof (evt.target.matches) === 'function' && evt.target.matches('.chart *, .tooltip *')) {
      return
    }

    this.tooltip.style.display = 'none'
  }

  render () {
    const { dataset, yMax } = this.state
    const width = this.base.current ? this.base.current.clientWidth : window.innerWidth
    const height = this.props.height || Math.max(240, Math.min(window.innerHeight / 3, window.innerWidth / 2, 360))
    const padding = {
      left: 36,
      bottom: 26,
      top: 6,
      right: 12
    }
    const innerWidth = width - padding.left - padding.right
    const innerHeight = height - padding.bottom - padding.top
    const ticks = dataset.length
    const tickWidth = innerWidth / ticks
    const barWidth = 0.9 * tickWidth
    const barPadding = 0.05 * tickWidth
    const getX = index => index * tickWidth
    const getY = value => yMax > 0 ? innerHeight - (value / yMax * innerHeight) : innerHeight
    const yStep = step(yMax, 3) || 1

    return (
      <div className='box'>
        <div className='chart-container'>
          <svg className='chart' ref={this.base} width='100%' height={height}>
            <g className='axes'>
              <g className='axes-y' transform={`translate(0, ${padding.top})`} textAnchor='end'>
                {[0, 1, 2, 3].map(v => {
                  const value = v * yStep
                  if (value > yMax) {
                    return
                  }

                  const y = getY(value)
                  return (
                    <g key={value}>
                      <line stroke='#DDD' x1={30} x2={width} y1={y} y2={y} />
                      <text fill='#999' x={24} y={y} dy='0.33em'>{numbers.formatPretty(value)}</text>
                    </g>
                  )
                })}
              </g>
              <g className='axes-x' transform={`translate(${padding.left}, ${padding.top + innerHeight})`} textAnchor='middle'>
                {dataset.map((d, i) => {
                  const x = getX(i) + 0.5 * tickWidth
                  return (
                    <g key={i}>
                      {(ticks < 90 || i === 0 || i % 7 === 0) && <line stroke='#DDD' x1={x} x2={x} y1='0' y2='6' />}
                      {i === 0 && <text fill='#999' x={x} y='10' dy='1em'>{format(d.date, 'MMM d, yyyy')}</text>}
                      {i === ticks - 1 && <text fill='#999' x={x} y='10' dy='1em'>{format(d.date, 'MMM d')}</text>}
                    </g>
                  )
                })}
              </g>
            </g>
            <g className='bars' transform={`translate(${padding.left}, ${padding.top})`}>
              {dataset.map((d, i) => {
                // do not draw unnecessary elements
                if (d.pageviews === 0) {
                  return
                }

                const pageviewHeight = d.pageviews / yMax * innerHeight
                const visitorHeight = d.visitors / yMax * innerHeight
                const x = getX(i) + barPadding
                const showTooltip = this.showTooltip(d, barWidth)

                return (<g
                  key={d.date}
                  onClick={showTooltip}
                  onMouseEnter={showTooltip}
                  onMouseLeave={this.hideTooltip}
                >
                  <rect
                    className='pageviews'
                    height={pageviewHeight - visitorHeight}
                    width={barWidth}
                    x={x}
                    y={getY(d.pageviews)}
                  />
                  <rect
                    className='visitors'
                    height={visitorHeight}
                    width={barWidth}
                    x={x}
                    y={getY(d.visitors)}
                  />
                </g>)
              })}
            </g>
          </svg>
        </div>
      </div>
    )
  }
}

Component.propTypes = {
  startDate: PropTypes.instanceOf(Date).isRequired,
  endDate: PropTypes.instanceOf(Date).isRequired,
  height: PropTypes.number
}
