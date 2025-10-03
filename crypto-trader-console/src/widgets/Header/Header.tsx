import { Burger, Container, Drawer, Group } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { type FC } from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '../../assets/logo.jpg';
import { ROUTERS_PATH } from '../../router/constants';
import styles from './Header.module.scss';

const Header: FC = () => {
  const [opened, { toggle, close }] = useDisclosure(false);
  const location = useLocation();

  const handleLinkClick = () => {
    if (opened) {
      close();
    }
  };

  return (
    <header className={styles.header}>
      <Container size="md" className={styles.inner}>
        <Link to={ROUTERS_PATH.dashboard} className={styles.link}>
          <img src={logo} alt="react" height={40} />
        </Link>

        <Group gap={5} visibleFrom="xs" display="flex">
          {links.map((link: ILink) => {
            const isActive = location.pathname === link.link;
            return (
              <Link
                key={link.label}
                to={link.link}
                className={styles.link}
                data-active={isActive || undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </Group>

        <Burger opened={opened} onClick={toggle} hiddenFrom="xs" size="sm" />

        <Drawer opened={opened} onClose={close} size="100%" padding="md">
          {links.map((link: ILink) => {
            const isActive = location.pathname === link.link;
            return (
              <Link
                key={link.label}
                to={link.link}
                className={styles.link}
                data-active={isActive || undefined}
                onClick={handleLinkClick}
              >
                {link.label}
              </Link>
            );
          })}
        </Drawer>
      </Container>
    </header>
  );
};

export default Header;

interface ILink {
  link: string;
  label: string;
}

const links: ILink[] = [
  { link: ROUTERS_PATH.dashboard, label: 'Dashboard' },
  { link: ROUTERS_PATH.configuration, label: 'Configuration' },
  { link: ROUTERS_PATH.positions, label: 'Positions' },
  { link: ROUTERS_PATH.analysis, label: 'Analysis' },
  { link: ROUTERS_PATH.logs, label: 'Logs' },
];
