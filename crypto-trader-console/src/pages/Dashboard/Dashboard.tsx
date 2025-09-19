import { useState, type FC } from 'react';
import { CardWrapper, CustomChart, Checkbox } from '../../components';
import './Dashboard.css';
import { availableCoinList } from './constant';
import useDashboard from './useDashboard';

const Dashboard: FC = () => {
  const [coinList, setCoinList] = useState(availableCoinList);

  const { spotUSDBalance, futuresUSDBalance, accountPnlData } = useDashboard();
  const currentPnl = accountPnlData?.realizedPnL ?? 0;
  const isPlusPnl = currentPnl >= 0;

  const handleChangeCoinList = (id: string) => () =>
    setCoinList((prevList) =>
      prevList.map((coin) =>
        coin.id === id ? { ...coin, isAvailable: !coin.isAvailable } : coin,
      ),
    );

  return (
    <div className="dashboard">
      <div className="dashboard-info">
        <CardWrapper>
          <p>
            Орієнтовний баланс спота: $
            {parseFloat((spotUSDBalance ?? 0).toFixed(6))}
          </p>
        </CardWrapper>
        <CardWrapper>
          <p>Орієнтовний баланс futures: ${futuresUSDBalance}</p>
        </CardWrapper>

        <CardWrapper>
          PNL за сьогодні{' '}
          <span className={isPlusPnl ? 'green' : 'red'}>
            {(isPlusPnl ? '+' : '-') + currentPnl}$
          </span>
        </CardWrapper>
      </div>

      {/* <CustomChart />

      <div className="dashboard-list">
        {coinList.map((coin) => (
          <Checkbox
            key={coin.id}
            label={coin.label}
            checked={coin.isAvailable}
            handleChange={handleChangeCoinList(coin.id)}
          />
        ))}
      </div> */}
    </div>
  );
};

export default Dashboard;
