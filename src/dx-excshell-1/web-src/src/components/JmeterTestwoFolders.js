import React, { useState, useEffect } from 'react'
import { Dialog, AlertDialog, DialogTrigger, Divider, Slider, ProgressBar, Item, Form, TextField, ActionButton, ListBox, Heading, Flex, DialogContainer, StatusLight, ContextualHelp, Content, Text, NumberField, Picker } from '@adobe/react-spectrum'
import ConfirmDialogJmeter from './ConfirmDialogJmeter'
import allActions from '../config.json'

function JmeterTestwoFolders(props) {
    const [sandboxName, setSandboxName] = useState("");
    const [_isJobLoading, set_IsJobLoading] = useState(false);
    const [opeConfirmation, setOpenConfirmation] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [mirrorLink, setMirrorLink] = useState(0);
    const [navLink, setNavLink] = useState(0);
    const [offerLink, setOfferLink] = useState(0);
    const [productLink, setProductLink] = useState(0);
    const [socialLink, setSocialLink] = useState(0);
    const [unsubLink, setUnsubLink] = useState(0);
    const [linkError, setLinkError] = useState("yellow");
    const [logFile, setLogFile] = useState("");
    const [totalOpens, setTotalOpens] = useState(0);
    const [mobExpPercentage, setMobExpPercentage] = useState(0);
    const [desktopClicks, setDesktopClicks] = useState(0);
    const [mobileClicks, setMobileClicks] = useState(0);
    const [numberTrackingLinks, setNumberTrackingLinks] = useState(0);
    const [mirrorPosition, setMirrorPosition] = useState("");
    const [navLinkPosition, setNavLinkPosition] = useState("");
    const [offerPosition, setOfferPosition] = useState("");
    const [productPosition, setProductPosition] = useState("");
    const [socialPosition, setSocialPosition] = useState("");
    const [unsubPosition, setUnsubPosition] = useState("");
    const [unsubscribe, setUnsubscribe] = useState(false);
    const [result, setResult] = useState('');
    const [globalSetErrors, setGlobalSetErrors] = useState("yellow");
    const [logFileName, setLogFileName] = useState("abbey_cjmadobe");

    const inboxConfigOptions = [
        "abbey_cjmadobe",
        "acc_americas90",
        "acc_ma1",
        "acc_pot5",
        "ajosand",
        "demo_cjmadobe",
        "jfiur_cjmadobe",
        "jousa_svpoc_abbey_beta",
        "ma1_demo1",
        "ma1_demo10",
        "ma1_demo11",
        "ma1_demo12",
        "ma1_demo13",
        "ma1_demo14",
        "ma1_demo15",
        "ma1_demo16",
        "ma1_demo17",
        "ma1_demo18",
        "ma1_demo19",
        "ma1_demo2",
        "ma1_demo20",
        "ma1_demo3",
        "ma1_demo4",
        "ma1_demo5",
        "ma1_demo6",
        "ma1_demo7",
        "ma1_demo8",
        "ma1_esphol1",
        "ma1_hol1",
        "ma1_hol10",
        "ma1_hol11",
        "ma1_hol12",
        "ma1_hol13",
        "ma1_hol14",
        "ma1_hol15",
        "ma1_hol16",
        "ma1_hol17",
        "ma1_hol18",
        "ma1_hol19",
        "ma1_hol2",
        "ma1_hol20",
        "ma1_hol3",
        "ma1_hol4",
        "ma1_hol5",
        "ma1_hol6",
        "ma1_hol7",
        "ma1_hol8",
        "ma1_poc1",
        "ma1_poc10",
        "ma1_poc11",
        "ma1_poc12",
        "ma1_poc13",
        "ma1_poc14",
        "ma1_poc15",
        "ma1_poc16",
        "ma1_poc17",
        "ma1_poc18",
        "ma1_poc19",
        "ma1_poc2",
        "ma1_poc20",
        "ma1_poc3",
        "ma1_poc4",
        "ma1_poc5",
        "ma1_poc6",
        "ma1_poc7",
        "ma1_poc8",
        "pot5/pot5_demo1",
        "pot5/pot5_demo10",
        "pot5/pot5_demo11",
        "pot5/pot5_demo12",
        "pot5/pot5_demo13",
        "pot5/pot5_demo14",
        "pot5/pot5_demo15",
        "pot5/pot5_demo16",
        "pot5/pot5_demo17",
        "pot5/pot5_demo18",
        "pot5/pot5_demo19",
        "pot5/pot5_demo2",
        "pot5/pot5_demo20",
        "pot5/pot5_demo3",
        "pot5/pot5_demo4",
        "pot5/pot5_demo5",
        "pot5/pot5_demo6",
        "pot5/pot5_demo7",
        "pot5/pot5_demo8",
        "pot5/pot5_hol1",
        "pot5/pot5_hol10",
        "pot5/pot5_hol11",
        "pot5/pot5_hol12",
        "pot5/pot5_hol13",
        "pot5/pot5_hol14",
        "pot5/pot5_hol15",
        "pot5/pot5_hol16",
        "pot5/pot5_hol17",
        "pot5/pot5_hol18",
        "pot5/pot5_hol19",
        "pot5/pot5_hol2",
        "pot5/pot5_hol20",
        "pot5/pot5_hol3",
        "pot5/pot5_hol4",
        "pot5/pot5_hol5",
        "pot5/pot5_hol6",
        "pot5/pot5_hol7",
        "pot5/pot5_hol8",
        "pot5/pot5_poc1",
        "pot5/pot5_poc10",
        "pot5/pot5_poc11",
        "pot5/pot5_poc12",
        "pot5/pot5_poc13",
        "pot5/pot5_poc14",
        "pot5/pot5_poc15",
        "pot5/pot5_poc16",
        "pot5/pot5_poc17",
        "pot5/pot5_poc18",
        "pot5/pot5_poc19",
        "pot5/pot5_poc2",
        "pot5/pot5_poc20",
        "pot5/pot5_poc3",
        "pot5/pot5_poc4",
        "pot5/pot5_poc5",
        "pot5/pot5_poc6",
        "pot5/pot5_poc7",
        "pot5/pot5_poc8"
    ];

    useEffect(() => {
        //validations:
        const total = mirrorLink + navLink + offerLink + productLink + socialLink + unsubLink;

        if (total > 100) {
            setLinkError("negative");
        }
        if (total < 100) {
            setLinkError("yellow")
        }
        if (total === 100) {
            setLinkError("positive")
        }

        if (logFileName.length > 0 &&
            totalOpens > 0 &&
            mobExpPercentage > 0 &&
            desktopClicks > 0 &&
            mobileClicks > 0 &&
            numberTrackingLinks > 0) {

            setGlobalSetErrors("positive");
            console.log("positive")
        } else {
            setGlobalSetErrors("yellow");
        }
    }, [mirrorLink, navLink, offerLink, productLink, socialLink, unsubLink, logFileName, totalOpens, mobExpPercentage, desktopClicks, mobileClicks, numberTrackingLinks]);

    function resetState() {
        //we reset the state after a successful submission...
        setMirrorLink(0);
        setNavLink(0);
        setOfferLink(0);
        setProductLink(0);
        setSocialLink(0);
        setUnsubLink(0);
        setLogFile("");
        setTotalOpens(0);
        setMobExpPercentage(0);
        setDesktopClicks(0);
        setMobileClicks(0);
        setNumberTrackingLinks(0);
        setMirrorPosition("");
        setOfferPosition("");
        setNavLinkPosition("");
        setOfferPosition("");
        setProductPosition("");
        setSocialPosition("");
        setUnsubPosition("");
        setUnsubscribe(false);
        setLogFileName("abbey_cjmadobe");
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

    function confirmation(data) {
        if (data) {
            console.log('sandbox to be Created:', sandboxName)
            setShowConfirmation(data);
        }

    }

    function handleFormSubmission(event) {
        event.preventDefault();

        const data = {
            "formBody": {
                "jmeter": {
                    "file_ref": logFileName,
                    "total_opens": totalOpens,
                    "mobile_experience_pct": mobExpPercentage,
                    "desk_clicks_pct": desktopClicks,
                    "mobile_clicks_pct": mobileClicks,
                    "links": {
                        "count_tracked": numberTrackingLinks,
                        "mirror": {
                            "pct": mirrorLink,
                            "pos": (mirrorPosition.trim() !== "") ? mirrorPosition.split(",").map(Number) : []
                        },
                        "navigation": {
                            "pct": navLink,
                            "pos": (navLinkPosition.trim() !== "") ? navLinkPosition.split(",").map(Number) : []
                        },
                        "offer": {
                            "pct": offerLink,
                            "pos": (offerPosition.trim() !== "") ? offerPosition.split(",").map(Number) : []
                        },
                        "product": {
                            "pct": productLink,
                            "pos": (productPosition.trim() !== "") ? productPosition.split(",").map(Number) : []
                        },
                        "social": {
                            "pct": socialLink,
                            "pos": (socialPosition.trim() !== "") ? socialPosition.split(",").map(Number) : []
                        },
                        "unsub": {
                            "pct": unsubLink,
                            "pos": (unsubPosition.trim() !== "") ? unsubPosition.split(",").map(Number) : [],
                            "persist": unsubscribe
                        }
                    }
                },
                "options": {
                    "project": "jmeter_svpoc",
                    "sandbox_name": sandboxName || ""
                }
            }
        }

        //We check there is no errors on the fields. 
        if (linkError === "positive" && globalSetErrors === 'positive') {
            console.log(JSON.stringify(data));
            set_IsJobLoading(true);
            callAction(JSON.stringify(data));
        }
    }

    function callAction(data) {
        fetchConfig['body'] = data;
        fetchConfig['method'] = 'POST';
        
        console.log('Calling jmeter action with config:', fetchConfig);
        
        fetch(allActions.jmeterNFemailTracking, fetchConfig)
            .then((response) => {
                console.log('Response status:', response.status);
                console.log('Response headers:', response.headers);
                
                if (!response.ok) {
                    // Handle HTTP errors
                    let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
                    
                    if (response.status === 403) {
                        errorMessage = 'Authorization failed (403). Please check your jmeterKey configuration.';
                    } else if (response.status === 500) {
                        errorMessage = 'Server error (500). Please try again later.';
                    } else if (response.status === 400) {
                        errorMessage = 'Bad request (400). Please check your input data.';
                    }
                    
                    throw new Error(errorMessage);
                }
                
                return response.json();
            })
            .then((data) => {
                console.log('Response data:', data);
                
                if (data.pid) {
                    // Success case
                    setResult(JSON.stringify(data, null, 2));
                    set_IsJobLoading(false);
                    setShowConfirmation(true);
                    resetState();
                    setGlobalSetErrors('yellow');
                    console.log('Form submitted successfully:', data);
                } else {
                    // Response without pid - treat as error
                    const errorData = {
                        error: true,
                        message: 'Response received but no process ID found',
                        details: data
                    };
                    setResult(JSON.stringify(errorData, null, 2));
                    set_IsJobLoading(false);
                    setShowConfirmation(true);
                }
            })
            .catch((error) => {
                console.error('Error calling jmeter action:', error);
                
                const errorData = {
                    error: true,
                    message: error.message || 'An unexpected error occurred',
                    details: error.toString()
                };
                
                setResult(JSON.stringify(errorData, null, 2));
                set_IsJobLoading(false);
                setShowConfirmation(true);
            });
    }

    return (
        <>
            <Heading level={3}>Run Jmeter Test without specific folder requirement</Heading>
            <Heading level={4}>Global Settings:</Heading>
            <StatusLight variant={globalSetErrors}>You must provide all fields in this section.</StatusLight><br></br>
            <Form onSubmit={handleFormSubmission}>
                <Flex direction="row" gap="size-100">
                    <TextField width="size-6000" label="Sandbox Name:" onChange={setSandboxName} value={sandboxName} />
                    <Picker
                        width="size-6000"
                        label="Inbox Config:"
                        selectedKey={logFileName}
                        onSelectionChange={setLogFileName}
                        isRequired={true}
                    >
                        {inboxConfigOptions.map((option) => (
                            <Item key={option}>{option}</Item>
                        ))}
                    </Picker>
                </Flex>
                <br></br>
                <Flex direction="row">
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
                </Flex>
                <Flex direction="row">
                    <Slider
                        isRequired={true}
                        onChange={setMobExpPercentage}
                        width="size-6000"
                        label="Mobile Experience Percentage"
                        maxValue={100}
                        value={mobExpPercentage}
                        isFilled
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Mobile Experience Percentage</Heading>
                                <Content>
                                    <Text>
                                        Maximum 100.
                                    </Text>
                                </Content>
                            </ContextualHelp>} />
                </Flex>
                <Flex direction="row">
                    <Slider
                        isRequired={true}
                        onChange={setDesktopClicks}
                        width="size-6000"
                        label="Desktop Clicks Percentage"
                        maxValue={100}
                        value={desktopClicks}
                        isFilled
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Desktop Clicks Percentage</Heading>
                                <Content>
                                    <Text>
                                        Maximum 100.
                                    </Text>
                                </Content>
                            </ContextualHelp>} />
                </Flex>
                <Flex direction="row">
                    <Slider
                        isRequired={true}
                        onChange={setMobileClicks}
                        width="size-6000"
                        label="Mobile Clicks Percentage"
                        maxValue={100}
                        value={mobileClicks}
                        isFilled
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Mobile Clicks Percentage</Heading>
                                <Content>
                                    <Text>
                                        Maximum 100.
                                    </Text>
                                </Content>
                            </ContextualHelp>} />
                </Flex>
                <Flex direction="row">
                    <Slider
                        isRequired={true}
                        onChange={setNumberTrackingLinks}
                        width="size-6000"
                        label="Number of Tracking Links"
                        maxValue={100}
                        value={numberTrackingLinks}
                        isFilled
                        contextualHelp={
                            <ContextualHelp variant="info" placement="top start" flex>
                                <Heading>Number of Tracking Links</Heading>
                                <Content>
                                    <Text>
                                        Maximum 100.
                                    </Text>
                                </Content>
                            </ContextualHelp>} />
                </Flex>
                <Heading level={4}>Link Distribution:</Heading>
                <StatusLight variant={linkError}>The total percentage must be 100%</StatusLight><br></br>
                <div style={{ marginBottom: '24px' }}>
                    <Flex direction="column" gap="size-200">
                        <Flex direction="row" alignItems="center" gap="size-600">
                            <Slider
                                isRequired={true}
                                onChange={setMirrorLink}
                                width="size-3200"
                                label="Mirror Link Percentage"
                                maxValue={100}
                                value={mirrorLink}
                                isFilled
                                contextualHelp={
                                    <ContextualHelp variant="info" placement="top start" flex>
                                        <Heading>Mirror Link Percentage</Heading>
                                        <Content>
                                            <Text>
                                                Maximum 100.
                                            </Text>
                                        </Content>
                                    </ContextualHelp>
                                }
                            />
                            <TextField
                                width="size-4800"
                                label="Mirror Link Positions"
                                onChange={setMirrorPosition}
                                value={mirrorPosition}
                                contextualHelp={
                                    <ContextualHelp variant="info" placement="top start" flex>
                                        <Heading>Mirror Link Positions</Heading>
                                        <Content>
                                            <Text>
                                                This field requires to enter a comma separated list of numbers.
                                                Each number represents the position of the Mirror links within your email.
                                                Check the email editor link tracking to get the position.
                                                Example: 1,2,3,4,5
                                            </Text>
                                        </Content>
                                    </ContextualHelp>
                                }
                            />
                        </Flex>
                        <Flex direction="row" alignItems="center" gap="size-600">
                            <Slider
                                isRequired={true}
                                onChange={setNavLink}
                                width="size-3200"
                                label="Navigation Percentage"
                                maxValue={100}
                                value={navLink}
                                isFilled
                                contextualHelp={
                                    <ContextualHelp variant="info" placement="top start" flex>
                                        <Heading>Navigation Percentage</Heading>
                                        <Content>
                                            <Text>
                                                Maximum 100.
                                            </Text>
                                        </Content>
                                    </ContextualHelp>
                                }
                            />
                            <TextField
                                width="size-4800"
                                label="Navigation Link Positions"
                                onChange={setNavLinkPosition}
                                value={navLinkPosition}
                                contextualHelp={
                                    <ContextualHelp variant="info" placement="top start" flex>
                                        <Heading>Navigation Link Positions</Heading>
                                        <Content>
                                            <Text>
                                                This field requires to enter a comma separated list of numbers.
                                                Each number represents the position of the Navigation links within your email.
                                                Check the email editor link tracking to get the position.
                                                Example: 1,2,3,4,5
                                            </Text>
                                        </Content>
                                    </ContextualHelp>
                                }
                            />
                        </Flex>
                        <Flex direction="row" alignItems="center" gap="size-600">
                            <Slider
                                isRequired={true}
                                onChange={setOfferLink}
                                width="size-3200"
                                label="Offer Link Percentage"
                                maxValue={100}
                                value={offerLink}
                                isFilled
                                contextualHelp={
                                    <ContextualHelp variant="info" placement="top start" flex>
                                        <Heading>Offer Link Percentage</Heading>
                                        <Content>
                                            <Text>
                                                Maximum 100.
                                            </Text>
                                        </Content>
                                    </ContextualHelp>
                                }
                            />
                            <TextField
                                width="size-4800"
                                label="Offer Link Positions"
                                onChange={setOfferPosition}
                                value={offerPosition}
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
                                }
                            />
                        </Flex>
                        <Flex direction="row" alignItems="center" gap="size-600">
                            <Slider
                                isRequired={true}
                                onChange={setProductLink}
                                width="size-3200"
                                label="Product _ Percentage"
                                maxValue={100}
                                value={productLink}
                                isFilled
                                contextualHelp={
                                    <ContextualHelp variant="info" placement="top start" flex>
                                        <Heading>Product Percentage</Heading>
                                        <Content>
                                            <Text>
                                                Maximum 100.
                                            </Text>
                                        </Content>
                                    </ContextualHelp>
                                }
                            />
                            <TextField
                                width="size-4800"
                                label="Product Link Positions"
                                onChange={setProductPosition}
                                value={productPosition}
                                contextualHelp={
                                    <ContextualHelp variant="info" placement="top start" flex>
                                        <Heading>Product Link Positions</Heading>
                                        <Content>
                                            <Text>
                                                This field requires to enter a comma separated list of numbers.
                                                Each number represents the position of the Product links within your email.
                                                Check the email editor link tracking to get the position.
                                                Example: 1,2,3,4,5
                                            </Text>
                                        </Content>
                                    </ContextualHelp>
                                }
                            />
                        </Flex>
                        <Flex direction="row" alignItems="center" gap="size-600">
                            <Slider
                                isRequired={true}
                                onChange={setSocialLink}
                                width="size-3200"
                                label="Social Link Percentage"
                                maxValue={100}
                                value={socialLink}
                                isFilled
                                contextualHelp={
                                    <ContextualHelp variant="info" placement="top start" flex>
                                        <Heading>Social Link Percentage</Heading>
                                        <Content>
                                            <Text>
                                                Maximum 100.
                                            </Text>
                                        </Content>
                                    </ContextualHelp>
                                }
                            />
                            <TextField
                                width="size-4800"
                                label="Social Link Positions"
                                onChange={setSocialPosition}
                                value={socialPosition}
                                contextualHelp={
                                    <ContextualHelp variant="info" placement="top start" flex>
                                        <Heading>Social Link Positions</Heading>
                                        <Content>
                                            <Text>
                                                This field requires to enter a comma separated list of numbers.
                                                Each number represents the position of the Social links within your email.
                                                Check the email editor link tracking to get the position.
                                                Example: 1,2,3,4,5
                                            </Text>
                                        </Content>
                                    </ContextualHelp>
                                }
                            />
                        </Flex>
                        <Flex direction="row" alignItems="center" gap="size-600">
                            <Slider
                                isRequired={true}
                                onChange={setUnsubLink}
                                width="size-3200"
                                label="Unsub Link Percentage"
                                maxValue={100}
                                value={unsubLink}
                                isFilled
                                contextualHelp={
                                    <ContextualHelp variant="info" placement="top start" flex>
                                        <Heading>Unsub Link Percentage</Heading>
                                        <Content>
                                            <Text>
                                                Maximum 100.
                                            </Text>
                                        </Content>
                                    </ContextualHelp>
                                }
                            />
                            <TextField
                                width="size-4800"
                                label="Unsubscribed Link Positions"
                                onChange={setUnsubPosition}
                                value={unsubPosition}
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
                                }
                            />
                        </Flex>
                    </Flex>
                    <hr style={{ margin: '32px 0', border: 'none', borderTop: '1px solid #eee' }} />
                </div>
                <Flex>
                    <ActionButton disabled={false} type="submit">Generate Email Reporting</ActionButton>
                </Flex>
            </Form>
            {_isJobLoading && (
                <ProgressBar aria-label="Loading.." isIndeterminate={true} />
            )}
            <DialogContainer onDismiss={() => setShowConfirmation(false)}>
                {showConfirmation && (
                    <ConfirmDialogJmeter
                        result={result}
                        onClose={() => setShowConfirmation(false)}
                    />
                )}
            </DialogContainer>
        </>
    );
}

export default JmeterTestwoFolders