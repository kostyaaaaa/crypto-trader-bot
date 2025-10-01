import { useState } from 'react';

const useCoinConfigTemplate = () => {
  const [activeTab, setActiveTab] = useState<string | null>('anal_config');

  return { activeTab, setActiveTab };
};

export default useCoinConfigTemplate;
