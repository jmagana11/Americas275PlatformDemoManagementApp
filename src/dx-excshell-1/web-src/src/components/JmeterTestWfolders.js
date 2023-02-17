import { useState, useEffect } from 'react';
import Settings from '@spectrum-icons/workflow/Settings';
import {
    TextField,
    Slider,
    ActionButton,
    DialogTrigger,
    DialogContainer,
    Dialog,
    Form,
    Heading,
    Content,
    Divider,
    Flex,
    StatusLight,
    ContextualHelp,
    Switch

} from '@adobe/react-spectrum';
import SandboxPicker from './SandboxPicker'
import ConfirmDialogJmeter from './ConfirmDialogJmeter'
import allActions from '../config.json'

function JmeterTestWfolders(props) {
    const [rows, setRows] = useState([{ textValue: '', sliders: [0, 0, 0] }]);
    const [mirrorLink, setMirrorLink] = useState(0);
    const [navLink, setNavLink] = useState(0);
    const [offerLink, setOfferLink] = useState(0);
    const [productLink, setProductLink] = useState(0);
    const [socialLink, setSocialLink] = useState(0);
    const [unsubLink, setUnsubLink] = useState(0);
    const [mirrorPosition, setMirrorPosition] = useState("");
    const [navLinkPosition, setNavLinkPosition] = useState("");
    const [offerPosition, setOfferPosition] = useState("");
    const [productPosition, setProductPosition] = useState("");
    const [socialPosition, setSocialPosition] = useState("");
    const [unsubPosition, setUnsubPosition] = useState("");
    const [unsubscribe, setUnsubscribe] = useState(false);
    const [result, setResult] = useState('');
    const [linkError, setLinkError] = useState("yellow");
    const [folderError, setFolderError] = useState("yellow");
    const [total, setTotal] = useState(0);
    const [sandboxName, setSandboxName] = useState("");
    const [totalOpens, setTotalOpens] = useState(0);
    const [mobExpPercentage, setMobExpPercentage] = useState(0);
    const [numberTrackingLinks, setNumberTrackingLinks] = useState(0);
    const [globalSetErrors, setGlobalSetErrors] = useState("yellow");
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [_isJobLoading, set_IsJobLoading] = useState(false);
    

    //Start setting the header object
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

    const payload = {"formBody":{
        "jmeter": {
            "file_ref": "",
            "total_opens": 0,
            "mobile_experience_pct": 0,
            "folders": {
                "first": {
                    "name": "",
                    "pct": 0,
                    "desk_click": 0,
                    "mob_click": 0
                }
            },
            "links": {
                
            }
        },
        "options": {
            "project": "jmeter_svpoc",
            "sandbox_name": ""
        }
    }}

    function confirmation(data) {
        if (data) {
            console.log('sandbox to be Created:', sandboxName)
            setShowConfirmation(data);
        }

    }

    function cleanSandboxName() {
        if (sandboxName.indexOf('-') !== -1) {
            const splitName = sandboxName.split('-');
            const newName = splitName[0];
            console.log(newName);
            return newName;
        } else {
            return sandboxName;
        }
    }

    useEffect(() => {
        //validations:
        const _total = mirrorLink + navLink + offerLink + productLink + socialLink + unsubLink;
        const sumOfFirstSliders = rows.reduce((acc, row) => acc + row.sliders[0], 0);
        setTotal(sumOfFirstSliders);

        if (_total > 100) {
            setLinkError("negative");
        }
        if (_total < 100) {
            setLinkError("yellow")
        }
        if (_total === 100) {
            setLinkError("positive")
        }
        if (sumOfFirstSliders === 100) {
            setFolderError("positive")
        }
        if (sumOfFirstSliders > 100) {
            setFolderError("negative")
        }

        if (sumOfFirstSliders < 100) {
            setFolderError('yellow')
        }

        if( sandboxName.length > 0 && 
            totalOpens > 0 && 
            mobExpPercentage > 0  && 
            numberTrackingLinks > 0){
                setGlobalSetErrors("positive");
                console.log("positive")
        }else{
            setGlobalSetErrors("yellow");
        }

    }, [mirrorLink, navLink, offerLink, productLink, socialLink, unsubLink, rows, sandboxName, totalOpens, mobExpPercentage, numberTrackingLinks]);

    const resetForm = () => {
        setRows([{ textValue: '', sliders: [0, 0, 0] }]);
        setTotal(0);
        setMirrorLink(0);
        setNavLink(0);
        setOfferLink(0);
        setProductLink(0);
        setSocialLink(0);
        setUnsubLink(0);
        setMirrorPosition("");
        setOfferPosition("");
        setNavLinkPosition("");
        setOfferPosition("");
        setProductPosition("");
        setSocialPosition("");
        setUnsubPosition("");
        setUnsubscribe(false);
        setTotalOpens(0);
        setMobExpPercentage(0);
        setNumberTrackingLinks(0);
    };

    //This handles our custom sandbox picker
    function handleSandboxSelection(selection) {
        setSandboxName(selection);
    }

    const handleAddRow = () => {
        if (rows.length < 4) {
            setRows([...rows, { textValue: '', sliders: [0, 0, 0] }]);
        } else {
            console.log('Maximum number of rows reached');
        }
    };

    const handleTextValueChange = (index, value) => {
        setRows(rows.map((row, i) => (i === index ? { ...row, textValue: value } : row)));
    };

    const handleSliderChange = (index, sliderIndex, value) => {
        setRows(rows.map((row, i) => {
            if (i === index) {
                const sliders = [...row.sliders];
                sliders[sliderIndex] = value;
                return { ...row, sliders };
            }
            return row;
        }));
        console.log(rows);
    };

    function callAction(data){
        fetchConfig['body'] = data;
        fetchConfig['method'] = 'POST';
        fetch(allActions.jmeterNFemailTracking, fetchConfig)
            .then((response) => response.json())
            .then((data) => {
                if (data) { 
                    setResult(JSON.stringify(data));
                    set_IsJobLoading(false); 
                    setShowConfirmation(true); 
                    resetForm();
                    setGlobalSetErrors('yellow');
                    console.log('Form submitted successfully:', data);
                }
                
            });
    }

    const handleSubmit = (event) => {
        event.preventDefault();

        if (total === 100 && linkError === "positive" && globalSetErrors === "positive") {
            console.log(rows);
            console.log(mirrorPosition);

            const links = {
                "count_tracked": numberTrackingLinks,
                "mirror": {
                    "pct": mirrorLink,
                    "pos": (mirrorPosition.split(",").map(Number).length > 0) ? mirrorPosition.split(",").map(Number) : []
                },
                "navigation": {
                    "pct": navLink,
                    "pos": (navLinkPosition.split(",").map(Number).length > 0) ? navLinkPosition.split(",").map(Number) : []
                },
                "offer": {
                    "pct": offerLink,
                    "pos": (offerPosition.split(",").map(Number).length > 0) ? offerPosition.split(",").map(Number) : []
                },
                "product": {
                    "pct": productLink,
                    "pos": (productPosition.split(",").map(Number).length > 0) ? productPosition.split(",").map(Number) : []
                },
                "social": {
                    "pct": socialLink,
                    "pos": (socialPosition.split(",").map(Number).length > 0) ? socialPosition.split(",").map(Number) : []
                },
                "unsub": {
                    "pct": unsubLink,
                    "pos": (unsubPosition.split(",").map(Number).length > 0) ? unsubPosition.split(",").map(Number) : [],
                    "persist": unsubscribe
                }
            }

            payload.formBody.jmeter.links = links;
            payload.formBody.jmeter.file_ref = `ma1_svpoc_${cleanSandboxName()}_testv9_beta0`; 
            payload.formBody.options.sandbox_name = sandboxName;
            payload.formBody.jmeter.total_opens = totalOpens;
            payload.formBody.jmeter.mobile_experience_pct = mobExpPercentage;

            for (let index = 0; index < rows.length; index++) {
                const element = rows[index];

                if (index == 0) {
                    payload.formBody.jmeter.folders.first.name = rows[index].textValue;
                    payload.formBody.jmeter.folders.first.pct = rows[index].sliders[0];
                    payload.formBody.jmeter.folders.first.desk_click = rows[index].sliders[1];
                    payload.formBody.jmeter.folders.first.mob_click = rows[index].sliders[2];
                }
                if (index == 1) {
                    payload.formBody.jmeter.folders.second ??= {};
                    payload.formBody.jmeter.folders.second.name = rows[index].textValue;
                    payload.formBody.jmeter.folders.second.pct = rows[index].sliders[0];
                    payload.formBody.jmeter.folders.second.desk_click = rows[index].sliders[1];
                    payload.formBody.jmeter.folders.second.mob_click = rows[index].sliders[2];
                }
                if (index == 2) {
                    payload.formBody.jmeter.folders.third ??= {};
                    payload.formBody.jmeter.folders.third.name = rows[index].textValue;
                    payload.formBody.jmeter.folders.third.pct = rows[index].sliders[0];
                    payload.formBody.jmeter.folders.third.desk_click = rows[index].sliders[1];
                    payload.formBody.jmeter.folders.third.mob_click = rows[index].sliders[2];
                }
                if (index == 3) {
                    payload.jmeter.folders.fourth ??= {};
                    payload.jmeter.folders.fourth.name = rows[index].textValue;
                    payload.jmeter.folders.fourth.pct = rows[index].sliders[0];
                    payload.jmeter.folders.fourth.desk_click = rows[index].sliders[1];
                    payload.jmeter.folders.fourth.mob_click = rows[index].sliders[2];
                }
            }
            console.log(payload);
            callAction(JSON.stringify(payload));
        } else {
            console.log("something is wrong");
        }
    };

    return (
        <>
            <Heading level={3}>
                Run Jmeter Test with specific folder requirements
            </Heading>
            <Heading level={4}>
            Global Settings:
            </Heading>
            <StatusLight variant={globalSetErrors}>You must provide all fields in this section.</StatusLight><br></br>
            <SandboxPicker
                contextualHelp={
                    {
                        "heading": "Sandbox Name",
                        "body": "This will determine which inbox should we look for the emails."
                    }}
                ims={props.ims}
                parentCallback={handleSandboxSelection} />
            <div><br></br></div>
            <div><br></br></div>
            <Slider
                isRequired={true}
                onChange={setTotalOpens}
                width="size-6000"
                label="Total Opens"
                maxValue={200}
                value={totalOpens}
                isFilled
                contextualHelp={
                    <ContextualHelp variant="info" placement="top start" flex>
                        <Heading>Total Opens</Heading>
                        <Content>
                            <Text>
                                Maximum 200.
                            </Text>
                        </Content>
                    </ContextualHelp>} />
            <Slider
                onChange={setMobExpPercentage}
                width="size-6000"
                label="Mobile Experience %"
                maxValue={100}
                value={mobExpPercentage}
                isFilled
                contextualHelp={
                    <ContextualHelp variant="info" placement="top start" flex>
                        <Heading>Mobile Experience %</Heading>
                        <Content>
                            <Text>
                                From the total opens how many will be mobile.
                            </Text>
                        </Content>
                    </ContextualHelp>} />
            <Slider
                onChange={setNumberTrackingLinks}
                width="size-6000"
                label="# of Tracking Links"
                maxValue={6}
                value={numberTrackingLinks}
                isFilled
                contextualHelp={
                    <ContextualHelp variant="info" placement="top start" flex>
                        <Heading>Desktop Experience %</Heading>
                        <Content>
                            <Text>
                                This refers to the desktop version reporting.
                            </Text>
                        </Content>
                    </ContextualHelp>} />
            <div><br></br></div>
            <div><br></br></div>
            <Divider />
            <div><br></br></div>
            <Heading level={4}>
                Folder Tracking Configuration:
            </Heading>
            <StatusLight variant={folderError}>All Folder Tracking Percentages must provide a total of 100%</StatusLight><br></br>
            <Heading align="center" level={1} color="red">Total: {total} %</Heading>
            <Form onSubmit={handleSubmit}>
                {rows.map((row, i) => (
                    <div key={i} >
                        <Flex direction="row" gap="size-500">
                            <TextField
                                label={`Folder #${i + 1} Name:`}
                                value={row.textValue}
                                onChange={(value) => handleTextValueChange(i, value)}
                                width={500}
                            />
                            <DialogTrigger type="popover" placement="right top" >
                                <ActionButton top='24px' aria-label="Icon only"> <Settings /></ActionButton>
                                <Dialog>
                                    <Heading>Folder #{i + 1} Configuration:</Heading>
                                    <Divider />
                                    <Content>
                                        <Slider
                                            label="Folder Tracking %:"
                                            value={row.sliders[0]}
                                            onChange={(value) => { handleSliderChange(i, 0, value); }}
                                            max={100}
                                        />
                                        <Slider
                                            label="Desktop Clicks %:"
                                            value={row.sliders[1]}
                                            onChange={(value) => { handleSliderChange(i, 1, value); }}
                                            max={100}
                                        />
                                        <Slider
                                            label="Mobile Clicks %:"
                                            value={row.sliders[2]}
                                            onChange={(value) => { handleSliderChange(i, 2, value); }}
                                            max={100}
                                        />
                                    </Content>
                                </Dialog>
                            </DialogTrigger>
                        </Flex>
                    </div>
                ))}
                <ActionButton variant="primary" onPress={handleAddRow} marginTop="size-100">
                    Add 1+ Folder
                </ActionButton>
                <div><br></br></div>
                <div><br></br></div>
                <Divider />
                <div><br></br></div>
                <Heading level={4}>
                    Link Tracking Configuration:
                </Heading>
                <StatusLight variant={linkError}>All Link Tracking Percentages must provide a total of 100%</StatusLight><br></br>
                <Heading align="center" level={1} color="red">Total: {mirrorLink + navLink + offerLink + productLink + socialLink + unsubLink} %</Heading>
                <Flex direction="row" gap="size-1000">
                    <Slider
                        onChange={setMirrorLink}
                        label="Mirror Link Tracking %"
                        maxValue={100}
                        value={mirrorLink}
                        isFilled
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Mirror Link Tracking %</Heading>
                                <Content>
                                    <Text>
                                        Set the % of click tracking for the mirror links.
                                    </Text>
                                </Content>
                            </ContextualHelp>} />
                    <TextField
                        onChange={setMirrorPosition}
                        value={mirrorPosition}
                        label="Mirror Link Positions"
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Mirror Link Positions</Heading>
                                <Content>
                                    <Text>
                                        This field requires to enter a comma separated list of numbers.
                                        Each number represents the position of the mirror links within your email.
                                        Check the email editor link tracking to get the position.
                                        Example: 1,2,3,4,5
                                    </Text>
                                </Content>
                            </ContextualHelp>
                        } />
                </Flex>
                <Flex direction="row" gap="size-1000">
                    <Slider
                        onChange={setNavLink}
                        label="Nav Link Tracking %"
                        maxValue={100}
                        value={navLink}
                        isFilled
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Nav Link Tracking %</Heading>
                                <Content>
                                    <Text>
                                        Set the % of click tracking for the Navigation links.
                                    </Text>
                                </Content>
                            </ContextualHelp>} />
                    <TextField
                        onChange={setNavLinkPosition}
                        value={navLinkPosition}
                        label="Nav Link Positions"
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Nav Link Positions</Heading>
                                <Content>
                                    <Text>
                                        This field requires to enter a comma separated list of numbers.
                                        Each number represents the position of the Navigation links within your email.
                                        Check the email editor link tracking to get the position.
                                        Example: 1,2,3,4,5
                                    </Text>
                                </Content>
                            </ContextualHelp>
                        } />
                </Flex>
                <Flex direction="row" gap="size-1000">
                    <Slider
                        onChange={setOfferLink}
                        label="Offer Link Tracking %"
                        value={offerLink}
                        maxValue={100}
                        isFilled
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Offer Link Tracking %</Heading>
                                <Content>
                                    <Text>
                                        Set the % of click tracking for the Offer links.
                                    </Text>
                                </Content>
                            </ContextualHelp>} />
                    <TextField
                        onChange={setOfferPosition}
                        value={offerPosition}
                        label="Offer Link Positions"
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Offer Link Positions</Heading>
                                <Content>
                                    <Text>
                                        This field requires to enter a comma separated list of numbers.
                                        Each number represents the position of the Offer links within your email.
                                        Check the email editor link tracking to get the position.
                                        Example: 1,2,3,4,5
                                    </Text>
                                </Content>
                            </ContextualHelp>
                        } />
                </Flex >
                <Flex direction="row" gap="size-1000">
                    <Slider
                        onChange={setProductLink}
                        label="Product Link Tracking %"
                        maxValue={100}
                        value={productLink}
                        isFilled
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Product Link Tracking %</Heading>
                                <Content>
                                    <Text>
                                        Set the % of click tracking for the Product links.
                                    </Text>
                                </Content>
                            </ContextualHelp>} />
                    <TextField
                        onChange={setProductPosition}
                        value={productPosition}
                        label="Product Link Positions"
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Product Link Tracking %</Heading>
                                <Content>
                                    <Text>
                                        This field requires to enter a comma separated list of numbers.
                                        Each number represents the position of the Product links within your email.
                                        Check the email editor link tracking to get the position.
                                        Example: 1,2,3,4,5
                                    </Text>
                                </Content>
                            </ContextualHelp>
                        } />
                </Flex >
                <Flex direction="row" gap="size-1000">
                    <Slider
                        onChange={setSocialLink}
                        label="Social Link Tracking %"
                        maxValue={100}
                        value={socialLink}
                        isFilled
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Social Link Tracking %</Heading>
                                <Content>
                                    <Text>
                                        Set the % of click tracking for the Social links.
                                    </Text>
                                </Content>
                            </ContextualHelp>} />
                    <TextField
                        onChange={setSocialPosition}
                        value={socialPosition}
                        label="Social Link Positions"
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Social Link Positions</Heading>
                                <Content>
                                    <Text>
                                        This field requires to enter a comma separated list of numbers.
                                        Each number represents the position of the social links within your email.
                                        Check the email editor link tracking to get the position.
                                        Example: 1,2,3,4,5
                                    </Text>
                                </Content>
                            </ContextualHelp>
                        } />
                </Flex >
                <Flex direction="row" gap="size-1000">
                    <Slider
                        onChange={setUnsubLink}
                        value={unsubLink}
                        label="Unsub Link Tracking %"
                        maxValue={100}
                        isFilled
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Unsub Link Tracking %</Heading>
                                <Content>
                                    <Text>
                                        Set the % of click tracking for the Unsubscribed/Opt-out links.
                                    </Text>
                                </Content>
                            </ContextualHelp>} />
                    <TextField
                        onChange={setUnsubPosition}
                        value={unsubPosition}
                        label="Unsubscribed Link Positions"
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Unsubscribed Link Positions</Heading>
                                <Content>
                                    <Text>
                                        This field requires to enter a comma separated list of numbers.
                                        Each number represents the position of the Unsubscribed links within your email.
                                        Check the email editor link tracking to get the position.
                                        Example: 1,2,3,4,5
                                    </Text>
                                </Content>
                            </ContextualHelp>
                        } />
                </Flex >
                <Switch
                    onChange={setUnsubscribe}
                    value={unsubscribe}
                    contextualHelp={
                        <ContextualHelp variant="info" placement="top start" flex>
                            <Heading>Unsubscribed Link Positions</Heading>
                            <Content>
                                <Text>
                                    This field requires to enter a comma separated list of numbers.
                                    Each number represents the position of the Unsubscribed links within your email.
                                    Check the email editor link tracking to get the position.
                                    Example: 1,2,3,4,5
                                </Text>
                            </Content>
                        </ContextualHelp>
                    }>Would you like to totally unsubscribe users in the platform?
                </Switch>
                <ActionButton variant="primary" type="submit" marginTop="size-200">
                    Submit
                </ActionButton>
                {_isJobLoading && (
                    <ProgressBar aria-label="Loading.." isIndeterminate={true} />
                )}
            </Form>
            <DialogContainer onDismiss={() => setShowConfirmation(null)}>
                {showConfirmation && (<ConfirmDialogJmeter context={sandboxName} message={result} parentCallback={confirmation} />)}
            </DialogContainer>
        </>
    );
}

export default JmeterTestWfolders
