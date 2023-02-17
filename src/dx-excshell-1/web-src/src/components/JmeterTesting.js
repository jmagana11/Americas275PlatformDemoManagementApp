import React from 'react'
import {
    Heading,
    View,
    Item,
    Tabs,
    TabList,
    TabPanels
} from '@adobe/react-spectrum'
import JmeterTestwoFolders from './JmeterTestwoFolders'
import DeleteSandbox from './DeleteSandbox'
import JmeterTestWfolders from './JmeterTestWfolders'

function JmeterTesting(props) {

    return (
        <View width="size-6000">
            <Heading>Jmeter Testing Services:</Heading>
            <Tabs aria-label="Sandbox Management Services:">
                <TabList>
                    <Item key="delete">Run without folders</Item>
                    <Item key="create">Run with folders</Item>
                </TabList>
                <TabPanels>
                    <Item key="delete">
                    <JmeterTestwoFolders ims={props.ims}/>
                    </Item>
                    <Item key="create">
                    <JmeterTestWfolders ims={props.ims}/>
                    </Item>
                </TabPanels>
            </Tabs>
        </View>
    );
}

export default JmeterTesting