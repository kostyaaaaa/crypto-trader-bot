import { useState, type FC } from "react";
import { CardWrapper, CustomChart, Checkbox } from "../../components";
import "./Dashboard.css";
import { availibleCoinList } from "./constant";

const Dashboard: FC = () => {
  const pnl = 100;
  const isPlusPnl = pnl > 0;

  const [coinList, setCoinList] = useState(availibleCoinList);

  const handleChangeCoinList = (id: string) => () =>
    setCoinList(prevList => prevList.map(coin => (coin.id === id ? { ...coin, isAvailible: !coin.isAvailible } : coin)));

  return (
    <div className="dashboard">
      <div className="dashboard-info"></div>
      <CardWrapper>
        <p>Орієнтовний баланс: 200$</p>
        PNL за сьогодні <span className={isPlusPnl ? "green" : "red"}>{(isPlusPnl ? "+" : "-") + pnl} $(100%)</span>
      </CardWrapper>

      <CustomChart />

      <div className="dashboard-list">
        {coinList.map(coin => (
          <Checkbox key={coin.id} label={coin.label} checked={coin.isAvailible} handleChange={handleChangeCoinList(coin.id)} />
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
