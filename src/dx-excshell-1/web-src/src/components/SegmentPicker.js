import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import {Picker,ProgressBar,Item} from '@adobe/react-spectrum'
import Function from '@spectrum-icons/workflow/Function'
import allActions from '../config.json'

function SegmentPicker(props){
    const [secondPickerItems, setSecondPickerItems] = useState([]);
    const [selectedSecondPickerItem, setSelectedSecondPickerItem] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    
    const actionHeaders = {
        'Content-Type': 'application/json'
    }

    const fetchConfig = {
        headers: actionHeaders
    }

    if (window.location.hostname === 'localhost') {
        actionHeaders['x-ow-extra-logging'] = 'on'
    }

    // set the authorization header and org from the ims props object
    if (props.ims.token && !actionHeaders.authorization) {
        actionHeaders.authorization = `Bearer ${props.ims.token}`
    }
    if (props.ims.org && !actionHeaders['x-gw-ims-org-id']) {
        actionHeaders['x-gw-ims-org-id'] = props.ims.org
    }

    function handleSelection(selection){
        setSelectedSecondPickerItem(selection);
        props.parentCallbackSeg(selection);
    }

    useEffect(() => {
        if (!props.sbxContext) {
            return;
        }
        console.log("secondPicker FirstItem selected", props.sbxContext)
        actionHeaders['sandboxName'] = props.sbxContext;
        fetch(allActions.getSegments, fetchConfig)
            .then((response) => response.json())
            .then((data) => {
                const options = data.segments.map((item) => ({
                    name: item.name,
                    value: item.id
                }));
                console.log(JSON.stringify(options));
                setSecondPickerItems(options);
                setIsLoading(false);
            });

    }, [props.sbxContext]);

    return(
    <>
        {isLoading && (
            <>
                <br></br>
                <ProgressBar isIndeterminate={true}/>
            </>
        )}
        {!isLoading && (
            <Picker
                label="Segment Picker:"
                isRequired={true}
                placeholder="Select an item"
                aria-label="Select anitem for the first picker"
                items={secondPickerItems}
                itemKey="value"
                onSelectionChange={(value) => { handleSelection(value); }}>
                {(item) => <Item key={item.value}>{item.name}</Item>}
            </Picker>
        )}
    </>)
}

export default SegmentPicker;