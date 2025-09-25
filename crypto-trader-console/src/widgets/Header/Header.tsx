import { Burger, Container, Drawer, Group } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { type FC } from 'react';
import styles from './Header.module.scss';
import { ROUTERS_PATH } from '../../router/constants';
import { Link, useLocation } from 'react-router-dom';
import logo from '../../assets/react.svg';

const Header: FC = () => {
  const [opened, { toggle }] = useDisclosure(false);
  const location = useLocation();

  return (
    <header className={styles.header}>
      <Container size="md" className={styles.inner}>
        <img src={logo} alt="react" />
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

        <Drawer opened={opened} onClose={toggle} size="100%" padding="md">
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
];
