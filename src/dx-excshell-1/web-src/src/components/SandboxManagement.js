import React from 'react'
import {
    Heading,
    View,
    Item,
    Tabs,
    TabList,
    TabPanels
} from '@adobe/react-spectrum'
import CreateSandbox from './CreateSandbox'
import DeleteSandbox from './DeleteSandbox'

function SandboxManagement(props) {

    return (
        <View width="size-6000">
            <Heading>Sandbox Management Services:</Heading>
            <Tabs aria-label="Sandbox Management Services:">
                <TabList>
                    <Item key="create">Create Sandbox</Item>
                    <Item key="delete">Delete Sandbox</Item>
                </TabList>
                <TabPanels>
                    <Item key="create">
                        <CreateSandbox ims={props.ims} />
                    </Item>
                    <Item key="delete">
                        <DeleteSandbox ims={props.ims} />
                    </Item>
                </TabPanels>
            </Tabs>
        </View>
    );
}

export default SandboxManagement