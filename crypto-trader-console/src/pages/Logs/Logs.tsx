import { Badge, ScrollArea, Table, Tabs, Text, Title } from '@mantine/core';
import { useEffect, useState, type FC } from 'react';
import { logsService } from '../../services';
import styles from './Logs.module.scss';

const Logs: FC = () => {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [, forceUpdate] = useState({});

  useEffect(() => {
    // Subscribe to logs updates and force re-render
    const unsubscribe = logsService.onLogsUpdate(() => {
      forceUpdate({}); // Trigger re-render when logs change
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Calculate log counts from current logs
  const logCounts = logsService.getLogCounts();

  // Filter logs based on active tab
  const filteredLogs = logsService.getLogsByLevel(activeTab);

  const formatTimestamp = (timestamp: string | Date) => {
    return new Date(timestamp).toLocaleString();
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'red';
      case 'warn':
        return 'yellow';
      case 'info':
        return 'blue';
      default:
        return 'gray';
    }
  };

  const rows = filteredLogs
    .filter(
      (log) => log && log._id && log.timestamp && log.level && log.message,
    )
    .map((log) => (
      <Table.Tr key={log._id}>
        <Table.Td>
          <Text size="xs" c="dimmed">
            {formatTimestamp(log.timestamp)}
          </Text>
        </Table.Td>
        <Table.Td>
          <Badge color={getLevelColor(log.level)} variant="light" size="sm">
            {log.level.toUpperCase()}
          </Badge>
        </Table.Td>
        <Table.Td>
          <Text size="sm" title={log.message}>
            {log.message}
          </Text>
        </Table.Td>
      </Table.Tr>
    ));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title order={2}>System Logs</Title>
      </div>

      <Tabs
        value={activeTab}
        onChange={(value) => setActiveTab(value || 'all')}
      >
        <Tabs.List>
          <Tabs.Tab value="all">All ({logCounts.total})</Tabs.Tab>
          <Tabs.Tab value="info">Info ({logCounts.info})</Tabs.Tab>
          <Tabs.Tab value="warn">Warnings ({logCounts.warn})</Tabs.Tab>
          <Tabs.Tab value="error">Errors ({logCounts.error})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value={activeTab} pt="md">
          <ScrollArea h={600}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Timestamp</Table.Th>
                  <Table.Th>Level</Table.Th>
                  <Table.Th>Message</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.length > 0 ? (
                  rows
                ) : (
                  <Table.Tr>
                    <Table.Td colSpan={5} style={{ textAlign: 'center' }}>
                      <Text c="dimmed">No logs found</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
};

export default Logs;
