import Chart from 'react-apexcharts';
import './CustomChart.css';
import type { FC } from 'react';
import { options } from './constants';

const CustomChart: FC = () => {
  return (
    <div className="chart">
      <Chart
        options={options}
        series={options.series}
        type="candlestick"
        height={350}
      />
    </div>
  );
};

export default CustomChart;
