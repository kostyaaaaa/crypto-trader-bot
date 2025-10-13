import type { FC } from 'react';

const iframeLink =
  'https://tinted-cover-390.notion.site/ebd/Technical-analysis-28b1cb81d99f804486c3dbb1d399db57';

const InfoPage: FC = () => {
  return (
    <div>
      <iframe
        allowFullScreen
        height="800px"
        sandbox="allow-same-origin allow-scripts"
        src={iframeLink}
        width="100%"
      />
    </div>
  );
};

export default InfoPage;
